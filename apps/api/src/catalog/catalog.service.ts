import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService, CacheTTL } from '../redis/cache.service';
import { CursorPage, DEFAULT_PAGE_SIZE } from '../common/pagination/cursor.util';
import { SuggestCigarDto } from './dto/suggest-cigar.dto';

export interface CigarSearchRow {
  id: string;
  name: string;
  line: string | null;
  countryCode: string;
  vitola: string | null;
  imageUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  brand: { id: string; name: string };
  score: number;
}

interface SearchCursor {
  score: number;
  id: string;
}

function encodeSearchCursor(score: number, id: string): string {
  return Buffer.from(JSON.stringify({ score, id })).toString('base64url');
}

function decodeSearchCursor(cursor: string | undefined): SearchCursor | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as SearchCursor;
    if (typeof parsed.score !== 'number' || !parsed.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Busca de catálogo (seção 5.3): combina full-text (`ts_rank` sobre o
 * `search_vector` já mantido por trigger no Postgres), tolerância a erro de
 * digitação (`similarity` via pg_trgm) e um pequeno boost de popularidade
 * (`log(1 + rating_count)`). Expressa via `$queryRaw` porque esse ranking
 * combinado não é representável no query builder do Prisma.
 */
@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async search(term: string, cursorRaw: string | undefined, currentUserId: string | null): Promise<CursorPage<CigarSearchRow>> {
    const cursor = decodeSearchCursor(cursorRaw);
    const limit = DEFAULT_PAGE_SIZE;

    // Cache só para a primeira página de buscas anônimas — resultados
    // seguintes (com cursor) ou de usuário autenticado (que pode ver seus
    // PENDING) não são cacheados.
    const cacheKey = `catalog:search:${term.toLowerCase()}`;
    if (!cursor && !currentUserId) {
      const cached = await this.cache.get<CursorPage<CigarSearchRow>>(cacheKey);
      if (cached) return cached;
    }

    const userFilter = currentUserId
      ? Prisma.sql`(c.status = 'APPROVED' OR (c.status = 'PENDING' AND c.suggested_by = ${currentUserId}::uuid))`
      : Prisma.sql`c.status = 'APPROVED'`;

    const cursorFilter = cursor
      ? Prisma.sql`AND (scored.score, scored.id) < (${cursor.score}::double precision, ${cursor.id}::uuid)`
      : Prisma.sql``;

    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        name: string;
        line: string | null;
        country_code: string;
        vitola: string | null;
        image_url: string | null;
        rating_avg: Prisma.Decimal;
        rating_count: number;
        status: 'APPROVED' | 'PENDING' | 'REJECTED';
        brand_id: string;
        brand_name: string;
        score: number;
      }[]
    >`
      WITH scored AS (
        SELECT
          c.id,
          c.name,
          c.line,
          c.country_code,
          c.vitola,
          c.image_url,
          c.rating_avg,
          c.rating_count,
          c.status,
          b.id AS brand_id,
          b.name AS brand_name,
          (
            coalesce(ts_rank(c.search_vector, websearch_to_tsquery('portuguese', unaccent(${term}))), 0) * 2.0
            + coalesce(similarity(c.name, ${term}), 0) * 1.0
            + ln(1 + c.rating_count) * 0.05
          ) AS score
        FROM cigars c
        JOIN brands b ON b.id = c.brand_id
        WHERE c.deleted_at IS NULL
          AND ${userFilter}
          AND (
            c.search_vector @@ websearch_to_tsquery('portuguese', unaccent(${term}))
            OR similarity(c.name, ${term}) > 0.2
          )
      )
      SELECT * FROM scored
      WHERE score > 0
      ${cursorFilter}
      ORDER BY score DESC, id DESC
      LIMIT ${limit + 1}
    `;

    const mapped: (CigarSearchRow & { createdAt: Date })[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      line: r.line,
      countryCode: r.country_code,
      vitola: r.vitola,
      imageUrl: r.image_url,
      ratingAvg: Number(r.rating_avg),
      ratingCount: r.rating_count,
      status: r.status,
      brand: { id: r.brand_id, name: r.brand_name },
      score: r.score,
      // paginateResults exige createdAt/id — reaproveitamos o helper genérico
      // trocando o campo de ordenação por `score` via encode customizado abaixo.
      createdAt: new Date(0),
    }));

    const hasMore = mapped.length > limit;
    const page = hasMore ? mapped.slice(0, limit) : mapped;
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? encodeSearchCursor(last.score, last.id) : null;

    const result: CursorPage<CigarSearchRow> = {
      items: page.map(({ createdAt, ...rest }) => rest),
      nextCursor,
    };

    if (!cursor && !currentUserId) {
      await this.cache.set(cacheKey, result, CacheTTL.CATALOG_SEARCH);
    }

    return result;
  }

  async getById(cigarId: string, currentUserId: string | null) {
    const cigar = await this.prisma.cigar.findFirst({
      where: {
        id: cigarId,
        deletedAt: null,
        OR: currentUserId
          ? [{ status: 'APPROVED' }, { status: 'PENDING', suggestedBy: currentUserId }]
          : [{ status: 'APPROVED' }],
      },
      include: { brand: true },
    });
    if (!cigar) throw new NotFoundException('Charuto não encontrado');

    const distributionRows = await this.prisma.$queryRaw<{ bucket: number; count: bigint }[]>`
      SELECT floor(rating)::int AS bucket, count(*)::bigint AS count
      FROM reviews
      WHERE cigar_id = ${cigarId}::uuid AND deleted_at IS NULL
      GROUP BY bucket
      ORDER BY bucket DESC
    `;
    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of distributionRows) {
      const bucket = Math.min(5, Math.max(1, row.bucket));
      ratingDistribution[bucket] = (ratingDistribution[bucket] ?? 0) + Number(row.count);
    }

    // Amostra das avaliações mais recentes para a ficha do charuto. A
    // listagem completa e paginada por cursor vive em `GET
    // /cigars/:cigarId/reviews` (módulo reviews).
    const reviews = await this.prisma.review.findMany({
      where: { cigarId, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 10,
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        flavorNotes: { include: { flavorNote: true } },
      },
    });

    return {
      id: cigar.id,
      name: cigar.name,
      line: cigar.line,
      countryCode: cigar.countryCode,
      vitola: cigar.vitola,
      lengthMm: cigar.lengthMm ? Number(cigar.lengthMm) : null,
      ringGauge: cigar.ringGauge,
      strength: cigar.strength,
      wrapper: cigar.wrapper,
      avgSmokeMinutes: cigar.avgSmokeMinutes,
      imageUrl: cigar.imageUrl,
      status: cigar.status,
      brand: { id: cigar.brand.id, name: cigar.brand.name, countryCode: cigar.brand.countryCode },
      ratingAvg: Number(cigar.ratingAvg),
      ratingCount: cigar.ratingCount,
      ratingDistribution,
      recentReviews: reviews.map((review) => ({
        id: review.id,
        rating: Number(review.rating),
        body: review.body,
        pairedWith: review.pairedWith,
        user: review.user,
        flavorNotes: review.flavorNotes.map((fn) => fn.flavorNote.name),
        createdAt: review.createdAt,
      })),
    };
  }

  /**
   * Sugestão de charuto ao catálogo (seção 5.3): fica `PENDING` até
   * aprovação por um admin. Quando aprovada — responsabilidade de um módulo
   * de administração numa fase futura — deve publicar
   * `DomainEvent.CIGAR_SUGGESTION_APPROVED` (ver
   * apps/api/src/queue/queue.constants.ts). Não implementado aqui.
   */
  async suggest(userId: string, dto: SuggestCigarDto) {
    if (!dto.brandId && !dto.brandName) {
      throw new BadRequestException('Informe brandId (marca existente) ou brandName (marca nova)');
    }

    let brandId = dto.brandId;
    if (!brandId) {
      const brand = await this.prisma.brand.upsert({
        where: { name: dto.brandName! },
        create: { name: dto.brandName!, countryCode: dto.countryCode },
        update: {},
      });
      brandId = brand.id;
    } else {
      const brand = await this.prisma.brand.findFirst({ where: { id: brandId, deletedAt: null } });
      if (!brand) throw new NotFoundException('Marca não encontrada');
    }

    const cigar = await this.prisma.cigar.create({
      data: {
        brandId,
        name: dto.name,
        line: dto.line,
        countryCode: dto.countryCode,
        vitola: dto.vitola,
        ringGauge: dto.ringGauge,
        lengthMm: dto.lengthMm,
        wrapper: dto.wrapper,
        avgSmokeMinutes: dto.avgSmokeMinutes,
        imageUrl: dto.imageUrl,
        status: 'PENDING',
        suggestedBy: userId,
        source: 'user_suggestion',
      },
      include: { brand: true },
    });

    return cigar;
  }
}
