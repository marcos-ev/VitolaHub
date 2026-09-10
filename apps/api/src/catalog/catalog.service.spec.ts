import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  let service: CatalogService;
  let prisma: {
    $queryRaw: jest.Mock;
    brand: { upsert: jest.Mock; findFirst: jest.Mock };
    cigar: { create: jest.Mock; findFirst: jest.Mock };
    review: { findMany: jest.Mock };
  };
  let cache: { get: jest.Mock; set: jest.Mock };

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn(),
      brand: { upsert: jest.fn(), findFirst: jest.fn() },
      cigar: { create: jest.fn(), findFirst: jest.fn() },
      review: { findMany: jest.fn() },
    };
    cache = { get: jest.fn(), set: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    service = moduleRef.get(CatalogService);
  });

  describe('search', () => {
    it('usa o cache para a primeira página de uma busca anônima e não consulta o banco', async () => {
      const cached = { items: [], nextCursor: null };
      cache.get.mockResolvedValue(cached);

      const result = await service.search('cohiba', undefined, null);

      expect(result).toBe(cached);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('consulta o banco via $queryRaw combinando full-text, trigram e boost, e cacheia o resultado', async () => {
      cache.get.mockResolvedValue(null);
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'cigar-1',
          name: 'Cohiba Robusto',
          line: 'Robusto',
          country_code: 'CU',
          vitola: 'Robusto',
          image_url: null,
          rating_avg: { toString: () => '4.5' } as unknown,
          rating_count: 10,
          status: 'APPROVED',
          brand_id: 'brand-1',
          brand_name: 'Cohiba',
          score: 1.23,
        },
      ]);

      const result = await service.search('cohiba', undefined, null);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        id: 'cigar-1',
        name: 'Cohiba Robusto',
        brand: { id: 'brand-1', name: 'Cohiba' },
      });
      expect(result.nextCursor).toBeNull();
      expect(cache.set).toHaveBeenCalledWith(
        'catalog:search:cohiba',
        result,
        expect.any(Number),
      );
    });

    it('não usa cache quando o usuário está autenticado (pode ver seus PENDING)', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await service.search('cohiba', undefined, 'user-1');

      expect(cache.get).not.toHaveBeenCalled();
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('gera nextCursor quando há mais resultados do que o tamanho da página', async () => {
      cache.get.mockResolvedValue(null);
      const rows = Array.from({ length: 21 }, (_, i) => ({
        id: `cigar-${i}`,
        name: `Charuto ${i}`,
        line: null,
        country_code: 'CU',
        vitola: null,
        image_url: null,
        rating_avg: { toString: () => '0' } as unknown,
        rating_count: 0,
        status: 'APPROVED',
        brand_id: 'brand-1',
        brand_name: 'Marca',
        score: 21 - i,
      }));
      prisma.$queryRaw.mockResolvedValue(rows);

      const result = await service.search('charuto', undefined, null);

      expect(result.items).toHaveLength(20);
      expect(result.nextCursor).not.toBeNull();
    });
  });

  describe('suggest', () => {
    it('lança BadRequestException quando nem brandId nem brandName são informados', async () => {
      await expect(
        service.suggest('user-1', {
          name: 'Novo Charuto',
          countryCode: 'BR',
        } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.cigar.create).not.toHaveBeenCalled();
    });

    it('cria a marca via upsert quando brandName é informado e cria o charuto como PENDING', async () => {
      prisma.brand.upsert.mockResolvedValue({ id: 'brand-new', name: 'Marca Nova' });
      prisma.cigar.create.mockResolvedValue({ id: 'cigar-new', status: 'PENDING' });

      const result = await service.suggest('user-1', {
        name: 'Novo Charuto',
        brandName: 'Marca Nova',
        countryCode: 'BR',
      } as never);

      expect(prisma.brand.upsert).toHaveBeenCalledWith({
        where: { name: 'Marca Nova' },
        create: { name: 'Marca Nova', countryCode: 'BR' },
        update: {},
      });
      expect(prisma.cigar.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            brandId: 'brand-new',
            status: 'PENDING',
            suggestedBy: 'user-1',
          }),
        }),
      );
      expect(result).toEqual({ id: 'cigar-new', status: 'PENDING' });
    });
  });
});
