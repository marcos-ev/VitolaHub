import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CursorPage, DEFAULT_PAGE_SIZE, decodeCursor, paginateResults } from '../common/pagination/cursor.util';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';
import { CreateShopReviewDto } from './dto/create-shop-review.dto';

// Raio médio da Terra em km — usado na fórmula de Haversine.
const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE_LAT = 111.32;

interface ShopDistanceRow {
  id: string;
  trade_name: string;
  address: string;
  lat: Prisma.Decimal;
  lng: Prisma.Decimal;
  whatsapp: string | null;
  instagram: string | null;
  is_verified: boolean;
  plan: string;
  avg_response_seconds: number | null;
  response_rate: Prisma.Decimal | null;
  distance_km: number;
}

export interface ShopListItem {
  id: string;
  tradeName: string;
  address: string;
  lat: number;
  lng: number;
  whatsapp: string | null;
  instagram: string | null;
  isVerified: boolean;
  plan: string;
  avgResponseSeconds: number | null;
  responseRate: number | null;
  distanceKm: number;
}

interface DistanceCursor {
  distanceKm: number;
  id: string;
}

function encodeDistanceCursor(distanceKm: number, id: string): string {
  return Buffer.from(JSON.stringify({ distanceKm, id })).toString('base64url');
}

function decodeDistanceCursor(cursor: string | undefined | null): DistanceCursor | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as DistanceCursor;
    if (typeof parsed.distanceKm !== 'number' || !parsed.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export interface SearchNearbyParams {
  lat: number;
  lng: number;
  radiusKm: number;
  city?: string;
  cursorRaw?: string;
}

/**
 * Charutarias parceiras (seção 5.6 / Fase 3a). Regras centrais:
 *  - Um usuário PJ só pode ter uma loja (`Shop.userId` único no schema).
 *  - Busca por proximidade usa bounding-box (aproveitando o índice
 *    `@@index([lat, lng])`) antes de calcular a distância exata por
 *    Haversine em SQL puro — evita escanear a tabela inteira a cada busca.
 *  - `avgResponseSeconds`/`responseRate` nunca são calculados aqui: são
 *    mantidos por `ResponseMetricsCron` e apenas lidos.
 *  - Filtro por marca (`brandId`) e fotos da loja não são suportados nesta
 *    fase — ver limitações documentadas em `searchNearby` e `getById`.
 */
@Injectable()
export class ShopsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateShopDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    if (user.accountType !== 'PJ') {
      throw new ForbiddenException('Apenas contas empresariais (PJ) podem cadastrar uma loja');
    }

    const existingShop = await this.prisma.shop.findUnique({ where: { userId } });
    if (existingShop) throw new ConflictException('Este usuário já possui uma loja cadastrada');

    const cnpjDigits = dto.cnpj.replace(/\D/g, '');
    if (cnpjDigits.length !== 14) {
      throw new BadRequestException('CNPJ deve conter 14 dígitos');
    }

    const cnpjTaken = await this.prisma.shop.findUnique({ where: { cnpj: cnpjDigits } });
    if (cnpjTaken) throw new ConflictException('Já existe uma loja cadastrada com este CNPJ');

    return this.prisma.shop.create({
      data: {
        userId,
        cnpj: cnpjDigits,
        tradeName: dto.tradeName,
        address: dto.address,
        lat: dto.lat,
        lng: dto.lng,
        whatsapp: dto.whatsapp,
        instagram: dto.instagram,
        hours: dto.hours as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async updateMe(userId: string, dto: UpdateShopDto) {
    const shop = await this.prisma.shop.findUnique({ where: { userId } });
    if (!shop) throw new NotFoundException('Você ainda não possui uma loja cadastrada');

    return this.prisma.shop.update({
      where: { id: shop.id },
      data: {
        address: dto.address,
        lat: dto.lat,
        lng: dto.lng,
        whatsapp: dto.whatsapp,
        instagram: dto.instagram,
        hours: dto.hours as Prisma.InputJsonValue | undefined,
        greetingMessage: dto.greetingMessage,
      },
    });
  }

  /**
   * Busca por proximidade (parâmetro central do enunciado). `city` é
   * aplicado como `ILIKE` sobre `address`, já que o schema não tem uma
   * coluna de cidade dedicada em `Shop` — simplificação pragmática
   * documentada no resumo da fase. `brandId` é aceito na assinatura por
   * compatibilidade futura, mas não filtra nada: o schema não tem uma
   * relação Shop↔Brand e criar uma tabela de junção está fora do escopo
   * (não podemos editar `prisma/schema.prisma`).
   *
   * Reconciliação com o painel admin (Fase 3b): lojas nascem com
   * `isVerified: false` (tanto no cadastro comum quanto na contratação
   * assistida PJ) e só devem aparecer na busca pública depois de aprovadas
   * em `POST /admin/shops/:id/verify` — por isso o filtro `is_verified = true`
   * abaixo. `GET /shops/:id` (perfil direto) e `GET /admin/shops` (painel)
   * continuam mostrando lojas não verificadas para quem já tem o link/acesso
   * admin.
   */
  async searchNearby(params: SearchNearbyParams): Promise<CursorPage<ShopListItem>> {
    const { lat, lng, radiusKm, city, cursorRaw } = params;
    const cursor = decodeDistanceCursor(cursorRaw);
    const limit = DEFAULT_PAGE_SIZE;

    const latDelta = radiusKm / KM_PER_DEGREE_LAT;
    const cosLat = Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
    const lngDelta = radiusKm / (KM_PER_DEGREE_LAT * cosLat);

    const cityFilter = city ? Prisma.sql`AND s.address ILIKE ${'%' + city + '%'}` : Prisma.empty;
    const cursorFilter = cursor
      ? Prisma.sql`AND (d.distance_km, d.id) > (${cursor.distanceKm}::double precision, ${cursor.id}::uuid)`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<ShopDistanceRow[]>`
      WITH bbox AS (
        SELECT *
        FROM shops s
        WHERE s.deleted_at IS NULL
          AND s.is_verified = true
          AND s.lat BETWEEN ${lat - latDelta} AND ${lat + latDelta}
          AND s.lng BETWEEN ${lng - lngDelta} AND ${lng + lngDelta}
          ${cityFilter}
      ),
      d AS (
        SELECT
          s.*,
          (
            ${EARTH_RADIUS_KM} * acos(
              LEAST(1, GREATEST(-1,
                cos(radians(${lat}::double precision)) * cos(radians(s.lat::double precision))
                  * cos(radians(s.lng::double precision) - radians(${lng}::double precision))
                + sin(radians(${lat}::double precision)) * sin(radians(s.lat::double precision))
              ))
            )
          ) AS distance_km
        FROM bbox s
      )
      SELECT
        d.id, d.trade_name, d.address, d.lat, d.lng, d.whatsapp, d.instagram,
        d.is_verified, d.plan, d.avg_response_seconds, d.response_rate, d.distance_km
      FROM d
      WHERE d.distance_km <= ${radiusKm}
      ${cursorFilter}
      ORDER BY d.distance_km ASC, d.id ASC
      LIMIT ${limit + 1}
    `;

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? encodeDistanceCursor(Number(last.distance_km), last.id) : null;

    return {
      items: page.map((row) => ({
        id: row.id,
        tradeName: row.trade_name,
        address: row.address,
        lat: Number(row.lat),
        lng: Number(row.lng),
        whatsapp: row.whatsapp,
        instagram: row.instagram,
        isVerified: row.is_verified,
        plan: row.plan,
        avgResponseSeconds: row.avg_response_seconds,
        responseRate: row.response_rate != null ? Number(row.response_rate) : null,
        distanceKm: Math.round(Number(row.distance_km) * 100) / 100,
      })),
      nextCursor,
    };
  }

  /**
   * Perfil completo da loja. Fotos ficam fora desta fase: o schema não tem
   * nenhum campo de mídia associado a `Shop` (não há relação com
   * `PostMedia` nem coluna própria) — uma iteração futura deve adicionar um
   * campo/tabela dedicada quando o schema puder ser alterado.
   */
  async getById(shopId: string) {
    const shop = await this.prisma.shop.findFirst({ where: { id: shopId, deletedAt: null } });
    if (!shop) throw new NotFoundException('Loja não encontrada');

    const [ratingAgg, recentReviews] = await Promise.all([
      this.prisma.shopReview.aggregate({
        where: { shopId, deletedAt: null },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.shopReview.findMany({
        where: { shopId, deletedAt: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 5,
      }),
    ]);

    const reviewerIds = [...new Set(recentReviews.map((review) => review.userId))];
    const reviewers = reviewerIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: reviewerIds } },
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        })
      : [];
    const reviewerById = new Map(reviewers.map((reviewer) => [reviewer.id, reviewer]));

    return {
      id: shop.id,
      tradeName: shop.tradeName,
      cnpj: shop.cnpj,
      address: shop.address,
      lat: Number(shop.lat),
      lng: Number(shop.lng),
      whatsapp: shop.whatsapp,
      instagram: shop.instagram,
      isVerified: shop.isVerified,
      plan: shop.plan,
      hours: shop.hours,
      // Mantidos por ResponseMetricsCron sobre os últimos 30 dias — nunca
      // calculados em tempo de leitura.
      avgResponseSeconds: shop.avgResponseSeconds,
      responseRate: shop.responseRate != null ? Number(shop.responseRate) : null,
      ratingAvg: ratingAgg._avg.rating != null ? Number(ratingAgg._avg.rating) : 0,
      ratingCount: ratingAgg._count._all,
      recentReviews: recentReviews.map((review) => ({
        id: review.id,
        rating: Number(review.rating),
        body: review.body,
        user: reviewerById.get(review.userId) ?? null,
        createdAt: review.createdAt,
      })),
      createdAt: shop.createdAt,
    };
  }

  /** Um usuário só pode ter uma avaliação por loja: atualiza em vez de duplicar. */
  async createOrUpdateReview(shopId: string, userId: string, dto: CreateShopReviewDto) {
    const shop = await this.prisma.shop.findFirst({ where: { id: shopId, deletedAt: null } });
    if (!shop) throw new NotFoundException('Loja não encontrada');

    const existing = await this.prisma.shopReview.findFirst({ where: { shopId, userId, deletedAt: null } });
    if (existing) {
      return this.prisma.shopReview.update({
        where: { id: existing.id },
        data: { rating: dto.rating, body: dto.body },
      });
    }

    return this.prisma.shopReview.create({
      data: { shopId, userId, rating: dto.rating, body: dto.body },
    });
  }

  async listReviews(shopId: string, cursorRaw?: string) {
    const cursor = decodeCursor(cursorRaw);
    const reviews = await this.prisma.shopReview.findMany({
      where: {
        shopId,
        deletedAt: null,
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
    });

    const page = paginateResults(reviews, DEFAULT_PAGE_SIZE);
    const reviewerIds = [...new Set(page.items.map((review) => review.userId))];
    const reviewers = reviewerIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: reviewerIds } },
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        })
      : [];
    const reviewerById = new Map(reviewers.map((reviewer) => [reviewer.id, reviewer]));

    return {
      items: page.items.map((review) => ({
        id: review.id,
        shopId: review.shopId,
        userId: review.userId,
        user: reviewerById.get(review.userId) ?? null,
        rating: Number(review.rating),
        body: review.body,
        createdAt: review.createdAt,
      })),
      nextCursor: page.nextCursor,
    };
  }

  async report(shopId: string, reporterId: string, reason: string) {
    const shop = await this.prisma.shop.findFirst({ where: { id: shopId, deletedAt: null } });
    if (!shop) throw new NotFoundException('Loja não encontrada');

    return this.prisma.report.create({
      data: { reporterId, entityType: 'SHOP', entityId: shopId, reason },
    });
  }
}
