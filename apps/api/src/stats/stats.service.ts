import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Papa from 'papaparse';
import { FeatureKey, FREE_REVIEW_HISTORY_DAYS } from '@charuto/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { CatalogService, CigarSearchRow } from '../catalog/catalog.service';
import { CursorPage, DEFAULT_PAGE_SIZE, decodeCursor, paginateResults } from '../common/pagination/cursor.util';
import { SearchAdvancedDto } from './dto/search-advanced.dto';

const MAX_COMPARE_CIGARS = 4;
const MIN_COMPARE_CIGARS = 2;
const MAX_TOP_FLAVOR_NOTES = 10;
const MONTHS_IN_SERIES = 12;

// Regra da ficha do charuto (Vivino-like): escalas 1-5 (perceivedStrength,
// draw, burn) normalizadas para 0-1 para o mobile desenhar barras
// bipolares/simples sem depender de conhecer o range original.
function normalizeOneToFive(value: number): number {
  return Math.min(1, Math.max(0, (value - 1) / 4));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface TopFlavorNote {
  id: string;
  name: string;
  count: number;
}

interface CountryTried {
  countryCode: string;
  count: number;
}

interface MonthlyReviewStat {
  month: string; // 'YYYY-MM'
  count: number;
  avgRating: number;
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Sempre devolve os últimos `MONTHS_IN_SERIES` meses, incluindo os que não
 * tiveram avaliação (count: 0) — o mobile desenha uma série temporal
 * completa e sóbria em vez de ter que preencher buracos no cliente.
 */
function buildMonthlySeries(entries: { date: Date; rating: number }[]): MonthlyReviewStat[] {
  const now = new Date();
  const buckets = new Map<string, { count: number; ratingSum: number }>();
  for (let i = MONTHS_IN_SERIES - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    buckets.set(monthKey(d), { count: 0, ratingSum: 0 });
  }
  for (const entry of entries) {
    const bucket = buckets.get(monthKey(entry.date));
    if (!bucket) continue; // fora da janela dos últimos 12 meses
    bucket.count += 1;
    bucket.ratingSum += entry.rating;
  }
  return [...buckets.entries()].map(([month, { count, ratingSum }]) => ({
    month,
    count,
    avgRating: count > 0 ? Number((ratingSum / count).toFixed(2)) : 0,
  }));
}

const historyInclude = {
  user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  cigar: { include: { brand: true } },
  flavorNotes: { include: { flavorNote: true } },
} satisfies Prisma.ReviewInclude;

type HistoryReview = Prisma.ReviewGetPayload<{ include: typeof historyInclude }>;

function toHistoryItemDto(review: HistoryReview) {
  return {
    id: review.id,
    cigarId: review.cigarId,
    cigar: {
      id: review.cigar.id,
      name: review.cigar.name,
      line: review.cigar.line,
      brand: { id: review.cigar.brand.id, name: review.cigar.brand.name },
      countryCode: review.cigar.countryCode,
      vitola: review.cigar.vitola,
    },
    postId: review.postId,
    rating: Number(review.rating),
    perceivedStrength: review.perceivedStrength,
    smokeMinutes: review.smokeMinutes,
    draw: review.draw,
    burn: review.burn,
    body: review.body,
    pairedWith: review.pairedWith,
    flavorNotes: review.flavorNotes.map((fn) => ({ id: fn.flavorNote.id, name: fn.flavorNote.name })),
    reviewDate: review.reviewDate,
    createdAt: review.createdAt,
  };
}

/**
 * Estatísticas do paladar, comparação, filtros avançados e exportação
 * (Fase 4b, seção 6.2). Recursos Premium são bloqueados via
 * `@RequireFeature` + `EntitlementsGuard` no controller — este service
 * assume que, quando chamado a partir de uma rota protegida, o acesso já foi
 * validado. A única exceção é `getHistory`, que é acessível a todos os
 * usuários autenticados mas FILTRA o conteúdo (nunca apaga dados) quando o
 * usuário não tem `FeatureKey.REVIEW_HISTORY_FULL`.
 */
@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly catalogService: CatalogService,
  ) {}

  /**
   * TTL de recomputação do painel do paladar: 1 hora. Escolha deliberada de
   * calcular sob demanda (não via fila do BullMQ como os contadores
   * desnormalizados em `queue/counters.service.ts`) porque o cálculo é
   * barato, específico por usuário (não compartilhado entre requests) e não
   * precisa ficar sempre atualizado em tempo real — 1h de defasagem é
   * aceitável para um painel de estatísticas pessoal. Se o custo crescer
   * (ex.: usuários com milhares de avaliações), mover para
   * `CountersService`/`DomainEventsService` fica fácil pois a assinatura de
   * `recomputeTasteProfile` já isola o cálculo puro do agendamento.
   */
  private static readonly TASTE_STATS_TTL_MS = 60 * 60 * 1000;

  async getTasteProfile(userId: string) {
    const existing = await this.prisma.tasteStats.findUnique({ where: { userId } });
    const isFresh = existing && Date.now() - existing.computedAt.getTime() < StatsService.TASTE_STATS_TTL_MS;
    if (existing && isFresh) {
      return this.toTasteProfileDto(existing);
    }
    return this.recomputeTasteProfile(userId);
  }

  private async recomputeTasteProfile(userId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { userId, deletedAt: null },
      select: {
        perceivedStrength: true,
        rating: true,
        reviewDate: true,
        cigar: { select: { countryCode: true } },
        flavorNotes: { select: { flavorNote: { select: { id: true, name: true } } } },
      },
    });

    const avgStrength = reviews.length
      ? reviews.reduce((sum, r) => sum + r.perceivedStrength, 0) / reviews.length
      : null;

    const flavorCounts = new Map<string, TopFlavorNote>();
    for (const review of reviews) {
      for (const fn of review.flavorNotes) {
        const entry = flavorCounts.get(fn.flavorNote.id) ?? { id: fn.flavorNote.id, name: fn.flavorNote.name, count: 0 };
        entry.count += 1;
        flavorCounts.set(fn.flavorNote.id, entry);
      }
    }
    const topFlavorNotes = [...flavorCounts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_TOP_FLAVOR_NOTES);

    const countryCounts = new Map<string, number>();
    for (const review of reviews) {
      const code = review.cigar.countryCode;
      countryCounts.set(code, (countryCounts.get(code) ?? 0) + 1);
    }
    const countriesTried: CountryTried[] = [...countryCounts.entries()]
      .map(([countryCode, count]) => ({ countryCode, count }))
      .sort((a, b) => b.count - a.count);

    const reviewsPerMonth = buildMonthlySeries(
      reviews.map((r) => ({ date: r.reviewDate, rating: Number(r.rating) })),
    );

    const computedAt = new Date();
    const avgStrengthDecimal = avgStrength !== null ? new Prisma.Decimal(avgStrength.toFixed(2)) : null;

    await this.prisma.tasteStats.upsert({
      where: { userId },
      create: {
        userId,
        avgStrength: avgStrengthDecimal,
        topFlavorNotes: topFlavorNotes as unknown as Prisma.InputJsonValue,
        countriesTried: countriesTried as unknown as Prisma.InputJsonValue,
        reviewsPerMonth: reviewsPerMonth as unknown as Prisma.InputJsonValue,
        computedAt,
      },
      update: {
        avgStrength: avgStrengthDecimal,
        topFlavorNotes: topFlavorNotes as unknown as Prisma.InputJsonValue,
        countriesTried: countriesTried as unknown as Prisma.InputJsonValue,
        reviewsPerMonth: reviewsPerMonth as unknown as Prisma.InputJsonValue,
        computedAt,
      },
    });

    return this.toTasteProfileDto({
      avgStrength: avgStrengthDecimal,
      topFlavorNotes: topFlavorNotes as unknown as Prisma.JsonValue,
      countriesTried: countriesTried as unknown as Prisma.JsonValue,
      reviewsPerMonth: reviewsPerMonth as unknown as Prisma.JsonValue,
      computedAt,
    });
  }

  private toTasteProfileDto(row: {
    avgStrength: Prisma.Decimal | null;
    topFlavorNotes: Prisma.JsonValue;
    countriesTried: Prisma.JsonValue;
    reviewsPerMonth: Prisma.JsonValue;
    computedAt: Date;
  }) {
    const avgStrength = row.avgStrength !== null ? Number(row.avgStrength) : null;
    return {
      avgStrength,
      avgStrengthNormalized: avgStrength !== null ? normalizeOneToFive(avgStrength) : null,
      topFlavorNotes: (row.topFlavorNotes as unknown as TopFlavorNote[] | null) ?? [],
      countriesTried: (row.countriesTried as unknown as CountryTried[] | null) ?? [],
      reviewsPerMonth: (row.reviewsPerMonth as unknown as MonthlyReviewStat[] | null) ?? [],
      computedAt: row.computedAt.toISOString(),
    };
  }

  /**
   * Histórico completo paginado por cursor. Regra de negócio (seção 6.2): o
   * dado nunca é apagado, só a VISUALIZAÇÃO é limitada a
   * `FREE_REVIEW_HISTORY_DAYS` (90 dias) para quem não tem
   * `FeatureKey.REVIEW_HISTORY_FULL`. `historyLimitedToDays` no retorno
   * avisa o mobile para mostrar o CTA de upgrade quando aplicável.
   */
  async getHistory(userId: string, cursorRaw: string | undefined): Promise<CursorPage<ReturnType<typeof toHistoryItemDto>> & { historyLimitedToDays: number | null }> {
    const snapshot = await this.entitlements.resolveForUser(userId);
    const hasFullHistory = snapshot.features[FeatureKey.REVIEW_HISTORY_FULL];
    const cutoff = hasFullHistory ? null : new Date(Date.now() - FREE_REVIEW_HISTORY_DAYS * 86_400_000);

    const cursor = decodeCursor(cursorRaw);
    const reviews = await this.prisma.review.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(cutoff ? { createdAt: { gte: cutoff } } : {}),
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: DEFAULT_PAGE_SIZE + 1,
      include: historyInclude,
    });

    const page = paginateResults(reviews, DEFAULT_PAGE_SIZE);
    return {
      items: page.items.map(toHistoryItemDto),
      nextCursor: page.nextCursor,
      historyLimitedToDays: hasFullHistory ? null : FREE_REVIEW_HISTORY_DAYS,
    };
  }

  /**
   * Comparação lado a lado (seção 6.2, recurso Premium). Reaproveita a
   * mesma lógica de distribuição de notas de `CatalogService.getById` via
   * uma query `$queryRaw` própria (pequena o bastante para não justificar
   * importar/acoplar ao service do catálogo) e acrescenta a média das
   * avaliações estruturadas da comunidade (força percebida, tiragem,
   * queima) por charuto.
   */
  async compare(userId: string, cigarIdsRaw: string) {
    const ids = [...new Set(cigarIdsRaw.split(',').map((id) => id.trim()).filter(Boolean))];
    if (ids.length < MIN_COMPARE_CIGARS) {
      throw new BadRequestException(`Informe ao menos ${MIN_COMPARE_CIGARS} charutos para comparar`);
    }
    if (ids.length > MAX_COMPARE_CIGARS) {
      throw new BadRequestException(`Máximo de ${MAX_COMPARE_CIGARS} charutos por comparação`);
    }

    const cigars = await this.prisma.cigar.findMany({
      where: { id: { in: ids }, deletedAt: null, status: 'APPROVED' },
      include: { brand: true },
    });
    if (cigars.length !== ids.length) {
      throw new NotFoundException('Um ou mais charutos não foram encontrados');
    }
    const cigarsById = new Map(cigars.map((c) => [c.id, c]));

    const results = await Promise.all(
      ids.map(async (id) => {
        const cigar = cigarsById.get(id)!;
        const [distributionRows, communityAvg] = await Promise.all([
          this.prisma.$queryRaw<{ bucket: number; count: bigint }[]>`
            SELECT floor(rating)::int AS bucket, count(*)::bigint AS count
            FROM reviews
            WHERE cigar_id = ${id}::uuid AND deleted_at IS NULL
            GROUP BY bucket
          `,
          this.prisma.review.aggregate({
            where: { cigarId: id, deletedAt: null },
            _avg: { perceivedStrength: true, draw: true, burn: true },
            _count: { _all: true },
          }),
        ]);

        const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        for (const row of distributionRows) {
          const bucket = Math.min(5, Math.max(1, row.bucket));
          ratingDistribution[bucket] = (ratingDistribution[bucket] ?? 0) + Number(row.count);
        }

        const avgPerceivedStrength = communityAvg._avg.perceivedStrength;

        return {
          id: cigar.id,
          name: cigar.name,
          line: cigar.line,
          brand: { id: cigar.brand.id, name: cigar.brand.name },
          countryCode: cigar.countryCode,
          vitola: cigar.vitola,
          lengthMm: cigar.lengthMm ? Number(cigar.lengthMm) : null,
          ringGauge: cigar.ringGauge,
          strength: cigar.strength,
          wrapper: cigar.wrapper,
          avgSmokeMinutes: cigar.avgSmokeMinutes,
          imageUrl: cigar.imageUrl,
          ratingAvg: Number(cigar.ratingAvg),
          ratingCount: cigar.ratingCount,
          ratingDistribution,
          community: {
            reviewCount: communityAvg._count._all,
            avgPerceivedStrength,
            avgPerceivedStrengthNormalized: avgPerceivedStrength !== null ? normalizeOneToFive(avgPerceivedStrength) : null,
            avgDraw: communityAvg._avg.draw,
            avgBurn: communityAvg._avg.burn,
          },
        };
      }),
    );

    // Preserva a ordem pedida em `cigarIds` (não a ordem devolvida pelo findMany).
    const byId = new Map(results.map((r) => [r.id, r]));
    return { cigars: ids.map((id) => byId.get(id)!) };
  }

  /**
   * Filtros avançados de busca (seção 6.2, recurso Premium). Design: em vez
   * de acrescentar os filtros ao `$queryRaw` combinado do
   * `CatalogService.search` (full-text + trigram + boost de popularidade —
   * ver comentário daquele método), chamamos o service já existente para
   * obter a página de resultados normal e aplicamos os filtros extras aqui,
   * via Prisma, sobre o `id` dos itens retornados. Isso evita qualquer risco
   * de regressão na busca principal (usada por todo mundo, inclusive
   * anônimos) por causa de um recurso que só afeta assinantes Premium.
   *
   * Simplificação assumida: como o filtro é aplicado DEPOIS da paginação da
   * busca base, uma página filtrada pode devolver menos itens do que
   * `DEFAULT_PAGE_SIZE` mesmo havendo mais correspondências adiante — o
   * cliente deve continuar paginando via `nextCursor` até ele vir `null`,
   * igual a qualquer outra busca cursor-based do app.
   */
  async searchAdvanced(userId: string | null, dto: SearchAdvancedDto): Promise<CursorPage<CigarSearchRow>> {
    const page = await this.catalogService.search(dto.q, dto.cursor, userId);
    if (page.items.length === 0) return page;

    const needsStrength = dto.minStrength !== undefined || dto.maxStrength !== undefined;
    const strengthById = new Map<string, number | null>();
    if (needsStrength) {
      const ids = page.items.map((item) => item.id);
      const cigars = await this.prisma.cigar.findMany({ where: { id: { in: ids } }, select: { id: true, strength: true } });
      for (const cigar of cigars) strengthById.set(cigar.id, cigar.strength);
    }

    const items = page.items.filter((item) => {
      if (dto.countryCode && item.countryCode !== dto.countryCode.toUpperCase()) return false;
      if (dto.vitola && item.vitola?.toLowerCase() !== dto.vitola.toLowerCase()) return false;
      if (dto.minRating !== undefined && item.ratingAvg < dto.minRating) return false;
      if (needsStrength) {
        const strength = strengthById.get(item.id) ?? null;
        if (strength === null) return false;
        if (dto.minStrength !== undefined && strength < dto.minStrength) return false;
        if (dto.maxStrength !== undefined && strength > dto.maxStrength) return false;
      }
      return true;
    });

    return { items, nextCursor: page.nextCursor };
  }

  /**
   * Exportação CSV (seção 6.2, recurso Premium). Sempre exporta TODAS as
   * avaliações do usuário, mesmo para quem não teria `REVIEW_HISTORY_FULL`
   * — a limitação de 90 dias vale só para a VISUALIZAÇÃO em
   * `GET /stats/history`; como este endpoint inteiro já é exclusivo
   * Premium, não faz sentido limitá-lo de novo.
   */
  async exportCsv(userId: string): Promise<string> {
    const reviews = await this.prisma.review.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        cigar: { include: { brand: true } },
        flavorNotes: { include: { flavorNote: true } },
      },
    });

    const rows = reviews.map((review) => ({
      data: review.reviewDate.toISOString().slice(0, 10),
      charuto: review.cigar.name,
      marca: review.cigar.brand.name,
      pais: review.cigar.countryCode,
      vitola: review.cigar.vitola ?? '',
      nota: Number(review.rating),
      forcaPercebida: review.perceivedStrength,
      tiragem: review.draw ?? '',
      queima: review.burn ?? '',
      minutosDeFumo: review.smokeMinutes ?? '',
      notasDeSabor: review.flavorNotes.map((fn) => fn.flavorNote.name).join('; '),
      comentario: review.body ?? '',
      harmonizacao: review.pairedWith ?? '',
    }));

    return Papa.unparse(rows);
  }

  /**
   * Exportação em "PDF" (seção 6.2, recurso Premium). Nenhuma lib nova foi
   * adicionada nesta fase para gerar PDF binário de verdade — geramos um
   * HTML formatado como substituto documentado. Próximo passo (fora do
   * escopo desta fase): avaliar `pdfkit` ou renderização headless
   * (ex.: Puppeteer) para gerar o PDF binário real, a critério do time.
   */
  async exportPdfHtml(userId: string): Promise<string> {
    const reviews = await this.prisma.review.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        cigar: { include: { brand: true } },
        flavorNotes: { include: { flavorNote: true } },
      },
    });

    const rowsHtml = reviews
      .map(
        (review) => `
      <tr>
        <td>${escapeHtml(review.reviewDate.toISOString().slice(0, 10))}</td>
        <td>${escapeHtml(review.cigar.brand.name)}</td>
        <td>${escapeHtml(review.cigar.name)}</td>
        <td>${escapeHtml(review.cigar.countryCode)}</td>
        <td>${Number(review.rating).toFixed(1)}</td>
        <td>${review.perceivedStrength}</td>
        <td>${escapeHtml(review.flavorNotes.map((fn) => fn.flavorNote.name).join(', '))}</td>
      </tr>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Minhas avaliações — Vitola Hub</title>
<style>
  body { font-family: Arial, sans-serif; padding: 24px; color: #2b2b2b; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  p.meta { color: #666; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; text-align: left; }
  th { background: #f4efe9; }
  p.aviso { margin-top: 24px; font-size: 11px; color: #777; }
</style>
</head>
<body>
  <h1>Minhas avaliações de charutos</h1>
  <p class="meta">Exportado em ${escapeHtml(new Date().toLocaleString('pt-BR'))} — total de ${reviews.length} avaliações.</p>
  <table>
    <thead>
      <tr><th>Data</th><th>Marca</th><th>Charuto</th><th>País</th><th>Nota</th><th>Força percebida</th><th>Notas de sabor</th></tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <p class="aviso">
    Este HTML é um substituto provisório para a exportação em PDF (nenhuma biblioteca nova foi
    adicionada nesta fase). Gerar um PDF binário real exigirá uma dependência como pdfkit ou
    renderização headless — fica como próximo passo, a critério do time.
  </p>
</body>
</html>`;
  }
}
