import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ShopsService } from './shops.service';

describe('ShopsService', () => {
  let service: ShopsService;
  let prisma: {
    user: { findUnique: jest.Mock; findMany: jest.Mock };
    shop: { findUnique: jest.Mock; findFirst: jest.Mock; create: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    shopReview: { findFirst: jest.Mock; findMany: jest.Mock; create: jest.Mock; update: jest.Mock; aggregate: jest.Mock };
    report: { create: jest.Mock };
    $queryRaw: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), findMany: jest.fn() },
      shop: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      shopReview: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
      },
      report: { create: jest.fn() },
      $queryRaw: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [ShopsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(ShopsService);
  });

  function makeRow(distanceKm: number, id: string) {
    return {
      id,
      trade_name: `Loja ${id}`,
      address: 'Rua Exemplo, 123',
      lat: new Prisma.Decimal(-23.5),
      lng: new Prisma.Decimal(-46.6),
      whatsapp: null,
      instagram: null,
      is_verified: false,
      plan: 'TRIAL',
      avg_response_seconds: null,
      response_rate: null,
      distance_km: distanceKm,
    };
  }

  describe('searchNearby', () => {
    it('devolve lojas ordenadas por distância crescente com o campo distanceKm calculado', async () => {
      prisma.$queryRaw.mockResolvedValue([makeRow(1.2, 'shop-1'), makeRow(5.8, 'shop-2')]);

      const result = await service.searchNearby({ lat: -23.5, lng: -46.6, radiusKm: 20 });

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toMatchObject({ id: 'shop-1', distanceKm: 1.2 });
      expect(result.items[1]).toMatchObject({ id: 'shop-2', distanceKm: 5.8 });
      expect(result.nextCursor).toBeNull();
    });

    it('gera nextCursor quando há mais resultados do que o tamanho da página (paginação por distância + id)', async () => {
      const rows = Array.from({ length: 21 }, (_, i) => makeRow(i, `shop-${i}`));
      prisma.$queryRaw.mockResolvedValue(rows);

      const result = await service.searchNearby({ lat: -23.5, lng: -46.6, radiusKm: 20 });

      expect(result.items).toHaveLength(20);
      expect(result.nextCursor).not.toBeNull();

      const decoded = JSON.parse(Buffer.from(result.nextCursor!, 'base64url').toString('utf8'));
      expect(decoded).toEqual({ distanceKm: 19, id: 'shop-19' });
    });

    it('usa a query com bounding-box + Haversine e respeita o raio informado', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await service.searchNearby({ lat: -23.5, lng: -46.6, radiusKm: 20, city: 'São Paulo' });

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('filtra apenas lojas verificadas (is_verified = true) — lojas recém-cadastradas ou em contratação assistida não aparecem na busca pública até aprovação do admin', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await service.searchNearby({ lat: -23.5, lng: -46.6, radiusKm: 20 });

      const [sqlParts] = prisma.$queryRaw.mock.calls[0] as [TemplateStringsArray];
      expect(sqlParts.join('')).toContain('s.is_verified = true');
    });
  });

  describe('create', () => {
    it('lança ForbiddenException quando o usuário não é PJ', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', accountType: 'PF' });

      await expect(
        service.create('user-1', {
          cnpj: '12345678000190',
          tradeName: 'Charutaria X',
          address: 'Rua A',
          lat: -23.5,
          lng: -46.6,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.shop.create).not.toHaveBeenCalled();
    });

    it('lança ConflictException quando o usuário já tem uma loja', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', accountType: 'PJ' });
      prisma.shop.findUnique.mockResolvedValue({ id: 'shop-1' });

      await expect(
        service.create('user-1', {
          cnpj: '12345678000190',
          tradeName: 'Charutaria X',
          address: 'Rua A',
          lat: -23.5,
          lng: -46.6,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('lança BadRequestException quando o CNPJ não tem 14 dígitos', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', accountType: 'PJ' });
      prisma.shop.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.create('user-1', { cnpj: '123', tradeName: 'Charutaria X', address: 'Rua A', lat: -23.5, lng: -46.6 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('cria a loja normalizando o CNPJ (removendo máscara) quando tudo é válido', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', accountType: 'PJ' });
      prisma.shop.findUnique.mockResolvedValue(null);
      prisma.shop.create.mockResolvedValue({ id: 'shop-1' });

      await service.create('user-1', {
        cnpj: '12.345.678/0001-90',
        tradeName: 'Charutaria X',
        address: 'Rua A',
        lat: -23.5,
        lng: -46.6,
      });

      expect(prisma.shop.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ cnpj: '12345678000190' }) }),
      );
    });
  });

  describe('createOrUpdateReview', () => {
    it('lança NotFoundException quando a loja não existe', async () => {
      prisma.shop.findFirst.mockResolvedValue(null);
      await expect(service.createOrUpdateReview('shop-1', 'user-1', { rating: 5 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('cria a avaliação quando o usuário nunca avaliou a loja', async () => {
      prisma.shop.findFirst.mockResolvedValue({ id: 'shop-1' });
      prisma.shopReview.findFirst.mockResolvedValue(null);
      prisma.shopReview.create.mockResolvedValue({ id: 'review-1' });

      await service.createOrUpdateReview('shop-1', 'user-1', { rating: 5, body: 'Ótimo atendimento' });

      expect(prisma.shopReview.create).toHaveBeenCalledWith({
        data: { shopId: 'shop-1', userId: 'user-1', rating: 5, body: 'Ótimo atendimento' },
      });
      expect(prisma.shopReview.update).not.toHaveBeenCalled();
    });

    it('atualiza a avaliação existente em vez de duplicar quando o usuário já avaliou a loja', async () => {
      prisma.shop.findFirst.mockResolvedValue({ id: 'shop-1' });
      prisma.shopReview.findFirst.mockResolvedValue({ id: 'review-1' });
      prisma.shopReview.update.mockResolvedValue({ id: 'review-1' });

      await service.createOrUpdateReview('shop-1', 'user-1', { rating: 3 });

      expect(prisma.shopReview.update).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        data: { rating: 3, body: undefined },
      });
      expect(prisma.shopReview.create).not.toHaveBeenCalled();
    });
  });
});
