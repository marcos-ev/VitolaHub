import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { FeatureKey, buildFeatureMap } from '@charuto/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { CatalogService } from '../catalog/catalog.service';
import { StatsService } from './stats.service';

function snapshotWithFeatures(overrides: Partial<Record<FeatureKey, boolean>> = {}) {
  return {
    isPremium: false,
    isTrial: false,
    trialEndsAt: null,
    premiumUntil: null,
    features: { ...buildFeatureMap(false), ...overrides },
    resolvedAt: new Date().toISOString(),
  };
}

describe('StatsService', () => {
  let service: StatsService;
  let prisma: {
    tasteStats: { findUnique: jest.Mock; upsert: jest.Mock };
    review: { findMany: jest.Mock; aggregate: jest.Mock };
    cigar: { findMany: jest.Mock };
    $queryRaw: jest.Mock;
  };
  let entitlements: { resolveForUser: jest.Mock };
  let catalogService: { search: jest.Mock };

  beforeEach(async () => {
    prisma = {
      tasteStats: { findUnique: jest.fn(), upsert: jest.fn() },
      review: { findMany: jest.fn(), aggregate: jest.fn() },
      cigar: { findMany: jest.fn() },
      $queryRaw: jest.fn(),
    };
    entitlements = { resolveForUser: jest.fn() };
    catalogService = { search: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        StatsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EntitlementsService, useValue: entitlements },
        { provide: CatalogService, useValue: catalogService },
      ],
    }).compile();

    service = moduleRef.get(StatsService);
  });

  describe('getTasteProfile', () => {
    it('recalcula e persiste quando não há TasteStats anterior', async () => {
      prisma.tasteStats.findUnique.mockResolvedValue(null);
      prisma.review.findMany.mockResolvedValue([
        {
          perceivedStrength: 3,
          rating: new Prisma.Decimal(4),
          reviewDate: new Date(),
          cigar: { countryCode: 'CU' },
          flavorNotes: [{ flavorNote: { id: 'fn-1', name: 'Terroso' } }],
        },
        {
          perceivedStrength: 5,
          rating: new Prisma.Decimal(3),
          reviewDate: new Date(),
          cigar: { countryCode: 'NI' },
          flavorNotes: [{ flavorNote: { id: 'fn-1', name: 'Terroso' } }],
        },
      ]);
      prisma.tasteStats.upsert.mockResolvedValue({});

      const result = await service.getTasteProfile('user-1');

      expect(prisma.tasteStats.upsert).toHaveBeenCalledTimes(1);
      expect(result.avgStrength).toBe(4);
      expect(result.avgStrengthNormalized).toBeCloseTo(0.75);
      expect(result.topFlavorNotes).toEqual([{ id: 'fn-1', name: 'Terroso', count: 2 }]);
      expect(result.countriesTried).toEqual(
        expect.arrayContaining([
          { countryCode: 'CU', count: 1 },
          { countryCode: 'NI', count: 1 },
        ]),
      );
      expect(result.reviewsPerMonth).toHaveLength(12);
    });

    it('usa o TasteStats persistido quando computedAt é recente (dentro do TTL de 1h)', async () => {
      prisma.tasteStats.findUnique.mockResolvedValue({
        userId: 'user-1',
        avgStrength: new Prisma.Decimal('3.50'),
        topFlavorNotes: [{ id: 'fn-1', name: 'Terroso', count: 5 }],
        countriesTried: [{ countryCode: 'CU', count: 5 }],
        reviewsPerMonth: [],
        computedAt: new Date(),
      });

      const result = await service.getTasteProfile('user-1');

      expect(prisma.review.findMany).not.toHaveBeenCalled();
      expect(prisma.tasteStats.upsert).not.toHaveBeenCalled();
      expect(result.avgStrength).toBe(3.5);
    });

    it('recalcula quando o TasteStats persistido está desatualizado (computedAt > 1h)', async () => {
      const stale = new Date(Date.now() - 2 * 60 * 60 * 1000);
      prisma.tasteStats.findUnique.mockResolvedValue({
        userId: 'user-1',
        avgStrength: new Prisma.Decimal('3.00'),
        topFlavorNotes: [],
        countriesTried: [],
        reviewsPerMonth: [],
        computedAt: stale,
      });
      prisma.review.findMany.mockResolvedValue([]);
      prisma.tasteStats.upsert.mockResolvedValue({});

      const result = await service.getTasteProfile('user-1');

      expect(prisma.review.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.tasteStats.upsert).toHaveBeenCalledTimes(1);
      expect(result.avgStrength).toBeNull();
    });
  });

  describe('getHistory', () => {
    const baseReview = {
      id: 'review-1',
      cigarId: 'cigar-1',
      postId: null,
      rating: new Prisma.Decimal(4),
      perceivedStrength: 3,
      smokeMinutes: null,
      draw: null,
      burn: null,
      body: null,
      pairedWith: null,
      reviewDate: new Date('2026-08-01'),
      createdAt: new Date('2026-08-01T12:00:00Z'),
      cigar: { id: 'cigar-1', name: 'Cohiba', line: null, countryCode: 'CU', vitola: 'Robusto', brand: { id: 'brand-1', name: 'Cohiba' } },
      flavorNotes: [],
    };

    it('filtra para os últimos 90 dias quando o usuário NÃO tem REVIEW_HISTORY_FULL', async () => {
      entitlements.resolveForUser.mockResolvedValue(snapshotWithFeatures({ [FeatureKey.REVIEW_HISTORY_FULL]: false }));
      prisma.review.findMany.mockResolvedValue([baseReview]);

      const result = await service.getHistory('user-1', undefined);

      expect(result.historyLimitedToDays).toBe(90);
      const whereArg = prisma.review.findMany.mock.calls[0][0].where;
      expect(whereArg.createdAt).toEqual({ gte: expect.any(Date) });
      expect(result.items).toHaveLength(1);
    });

    it('não filtra por data quando o usuário TEM REVIEW_HISTORY_FULL', async () => {
      entitlements.resolveForUser.mockResolvedValue(snapshotWithFeatures({ [FeatureKey.REVIEW_HISTORY_FULL]: true }));
      prisma.review.findMany.mockResolvedValue([baseReview]);

      const result = await service.getHistory('user-1', undefined);

      expect(result.historyLimitedToDays).toBeNull();
      const whereArg = prisma.review.findMany.mock.calls[0][0].where;
      expect(whereArg.createdAt).toBeUndefined();
    });
  });

  describe('compare', () => {
    const cigarRow = (id: string, name: string) => ({
      id,
      name,
      line: null,
      countryCode: 'CU',
      vitola: 'Robusto',
      lengthMm: new Prisma.Decimal(124),
      ringGauge: 50,
      strength: 4,
      wrapper: 'Maduro',
      avgSmokeMinutes: 45,
      imageUrl: null,
      ratingAvg: new Prisma.Decimal('4.20'),
      ratingCount: 10,
      brand: { id: 'brand-1', name: 'Cohiba' },
    });

    it('lança BadRequestException com menos de 2 charutos', async () => {
      await expect(service.compare('user-1', 'cigar-1')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.cigar.findMany).not.toHaveBeenCalled();
    });

    it('lança BadRequestException com mais de 4 charutos', async () => {
      await expect(service.compare('user-1', 'a,b,c,d,e')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('lança NotFoundException quando algum charuto não existe', async () => {
      prisma.cigar.findMany.mockResolvedValue([cigarRow('cigar-1', 'Cohiba')]);
      await expect(service.compare('user-1', 'cigar-1,cigar-2')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('devolve os charutos na ordem pedida com distribuição de notas e médias da comunidade', async () => {
      prisma.cigar.findMany.mockResolvedValue([cigarRow('cigar-2', 'Partagas'), cigarRow('cigar-1', 'Cohiba')]);
      prisma.$queryRaw.mockResolvedValue([{ bucket: 4, count: BigInt(3) }]);
      prisma.review.aggregate.mockResolvedValue({
        _avg: { perceivedStrength: 3.5, draw: 4, burn: 4.2 },
        _count: { _all: 10 },
      });

      const result = await service.compare('user-1', 'cigar-1,cigar-2');

      expect(result.cigars.map((c) => c.id)).toEqual(['cigar-1', 'cigar-2']);
      expect(result.cigars[0].ratingDistribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 3, 5: 0 });
      expect(result.cigars[0].community).toMatchObject({
        reviewCount: 10,
        avgPerceivedStrength: 3.5,
        avgDraw: 4,
        avgBurn: 4.2,
      });
      expect(result.cigars[0].community.avgPerceivedStrengthNormalized).toBeCloseTo(0.625);
    });
  });

  describe('searchAdvanced', () => {
    const baseItem = {
      id: 'cigar-1',
      name: 'Cohiba Robusto',
      line: null,
      countryCode: 'CU',
      vitola: 'Robusto',
      imageUrl: null,
      ratingAvg: 4.5,
      ratingCount: 10,
      status: 'APPROVED' as const,
      brand: { id: 'brand-1', name: 'Cohiba' },
      score: 1.2,
    };

    it('aplica filtro de countryCode sobre o resultado da busca base', async () => {
      catalogService.search.mockResolvedValue({
        items: [baseItem, { ...baseItem, id: 'cigar-2', countryCode: 'NI' }],
        nextCursor: null,
      });

      const result = await service.searchAdvanced('user-1', { q: 'cohiba', countryCode: 'NI' } as never);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('cigar-2');
    });

    it('aplica filtro de força (minStrength/maxStrength) consultando o Prisma pelo campo strength', async () => {
      catalogService.search.mockResolvedValue({ items: [baseItem], nextCursor: null });
      prisma.cigar.findMany.mockResolvedValue([{ id: 'cigar-1', strength: 2 }]);

      const result = await service.searchAdvanced('user-1', { q: 'cohiba', minStrength: 4 } as never);

      expect(prisma.cigar.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['cigar-1'] } },
        select: { id: true, strength: true },
      });
      expect(result.items).toHaveLength(0);
    });

    it('sem filtros extras, devolve a página da busca base sem consultar o Prisma', async () => {
      catalogService.search.mockResolvedValue({ items: [baseItem], nextCursor: 'abc' });

      const result = await service.searchAdvanced('user-1', { q: 'cohiba' } as never);

      expect(prisma.cigar.findMany).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toBe('abc');
    });
  });

  describe('exportCsv', () => {
    it('gera CSV com todas as avaliações do usuário, sem filtro de data', async () => {
      prisma.review.findMany.mockResolvedValue([
        {
          reviewDate: new Date('2026-01-15'),
          rating: new Prisma.Decimal(4.5),
          perceivedStrength: 3,
          draw: 4,
          burn: 4,
          smokeMinutes: 40,
          body: 'Ótimo charuto',
          pairedWith: 'Café',
          cigar: { name: 'Cohiba Robusto', countryCode: 'CU', vitola: 'Robusto', brand: { name: 'Cohiba' } },
          flavorNotes: [{ flavorNote: { name: 'Terroso' } }, { flavorNote: { name: 'Amadeirado' } }],
        },
      ]);

      const csv = await service.exportCsv('user-1');

      expect(prisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1', deletedAt: null } }),
      );
      expect(csv).toContain('Cohiba Robusto');
      expect(csv).toContain('Terroso; Amadeirado');
      expect(csv.split('\n')[0]).toContain('charuto');
    });
  });

  describe('exportPdfHtml', () => {
    it('gera HTML formatado como substituto documentado do PDF', async () => {
      prisma.review.findMany.mockResolvedValue([
        {
          reviewDate: new Date('2026-01-15'),
          rating: new Prisma.Decimal(4.5),
          perceivedStrength: 3,
          cigar: { name: 'Cohiba Robusto', countryCode: 'CU', brand: { name: 'Cohiba' } },
          flavorNotes: [],
        },
      ]);

      const html = await service.exportPdfHtml('user-1');

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Cohiba Robusto');
      expect(html.toLowerCase()).toContain('pdf');
    });
  });
});
