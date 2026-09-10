import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FREE_HUMIDOR_LIMIT } from '@charuto/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { DomainEventsService } from '../queue/domain-events.service';
import { HumidorService } from './humidor.service';

describe('HumidorService', () => {
  let service: HumidorService;
  let prisma: {
    cigar: { findFirst: jest.Mock };
    humidorItem: { count: jest.Mock; create: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
  };
  let entitlements: { resolveForUser: jest.Mock };
  let domainEvents: { publish: jest.Mock };

  const freeSnapshot = { isPremium: false, isTrial: false };
  const premiumSnapshot = { isPremium: true, isTrial: false };

  beforeEach(async () => {
    prisma = {
      cigar: { findFirst: jest.fn() },
      humidorItem: {
        count: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    entitlements = { resolveForUser: jest.fn() };
    domainEvents = { publish: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        HumidorService,
        { provide: PrismaService, useValue: prisma },
        { provide: EntitlementsService, useValue: entitlements },
        { provide: DomainEventsService, useValue: domainEvents },
      ],
    }).compile();

    service = moduleRef.get(HumidorService);
  });

  describe('limite gratuito de 25 itens', () => {
    it('bloqueia com 403 quando usuário free já tem 25 itens ativos', async () => {
      prisma.cigar.findFirst.mockResolvedValue({ id: 'cigar-1' });
      entitlements.resolveForUser.mockResolvedValue(freeSnapshot);
      prisma.humidorItem.count.mockResolvedValue(FREE_HUMIDOR_LIMIT);

      await expect(service.addItem('user-1', { cigarId: 'cigar-1' })).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.humidorItem.create).not.toHaveBeenCalled();
    });

    it('permite adicionar quando usuário free tem menos de 25 itens', async () => {
      prisma.cigar.findFirst.mockResolvedValue({ id: 'cigar-1' });
      entitlements.resolveForUser.mockResolvedValue(freeSnapshot);
      prisma.humidorItem.count.mockResolvedValue(24);
      prisma.humidorItem.create.mockResolvedValue({ id: 'item-1', cigarId: 'cigar-1' });

      const result = await service.addItem('user-1', { cigarId: 'cigar-1' });

      expect(result.readOnly).toBe(false);
      expect(domainEvents.publish).toHaveBeenCalledWith('HUMIDOR_ITEM_ADDED', {
        userId: 'user-1',
        humidorItemId: 'item-1',
        cigarId: 'cigar-1',
      });
    });

    it('permite adicionar sem limite quando usuário é Premium/trial', async () => {
      prisma.cigar.findFirst.mockResolvedValue({ id: 'cigar-1' });
      entitlements.resolveForUser.mockResolvedValue(premiumSnapshot);
      prisma.humidorItem.create.mockResolvedValue({ id: 'item-2', cigarId: 'cigar-1' });

      await service.addItem('user-1', { cigarId: 'cigar-1' });

      // Nem precisa contar itens ativos quando já é Premium.
      expect(prisma.humidorItem.count).not.toHaveBeenCalled();
      expect(prisma.humidorItem.create).toHaveBeenCalled();
    });

    it('lança 404 quando o charuto não existe', async () => {
      prisma.cigar.findFirst.mockResolvedValue(null);

      await expect(service.addItem('user-1', { cigarId: 'cigar-x' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('modo somente leitura acima do limite', () => {
    it('marca itens além dos 25 mais antigos como readOnly ao listar (usuário free)', async () => {
      entitlements.resolveForUser.mockResolvedValue(freeSnapshot);
      prisma.humidorItem.count.mockResolvedValue(30);
      prisma.humidorItem.findMany
        .mockResolvedValueOnce(
          Array.from({ length: FREE_HUMIDOR_LIMIT }, (_, i) => ({ id: `editable-${i}` })),
        )
        .mockResolvedValueOnce([
          { id: 'editable-0', acquiredAt: new Date('2026-01-01') },
          { id: 'readonly-extra', acquiredAt: new Date('2026-02-01') },
        ]);

      const result = await service.listMine('user-1', 1, 20);

      expect(result.total).toBe(30);
      const byId = Object.fromEntries(result.items.map((item) => [item.id, item.readOnly]));
      expect(byId['editable-0']).toBe(false);
      expect(byId['readonly-extra']).toBe(true);
    });

    it('não marca nada como readOnly quando o usuário é Premium, mesmo acima de 25', async () => {
      entitlements.resolveForUser.mockResolvedValue(premiumSnapshot);
      prisma.humidorItem.count.mockResolvedValue(30);
      prisma.humidorItem.findMany.mockResolvedValueOnce([
        { id: 'item-a', acquiredAt: new Date('2026-01-01') },
        { id: 'item-b', acquiredAt: new Date('2026-02-01') },
      ]);

      const result = await service.listMine('user-1', 1, 20);

      expect(result.items.every((item) => item.readOnly === false)).toBe(true);
      // Como é Premium, nem precisa calcular o conjunto de itens editáveis.
      expect(prisma.humidorItem.findMany).toHaveBeenCalledTimes(1);
    });

    it('bloqueia edição de item readOnly para usuário free', async () => {
      entitlements.resolveForUser.mockResolvedValue(freeSnapshot);
      prisma.humidorItem.findFirst.mockResolvedValue({ id: 'item-30', acquiredAt: new Date('2026-03-01') });
      prisma.humidorItem.count.mockResolvedValue(FREE_HUMIDOR_LIMIT + 1); // rank 26: além do limite

      await expect(service.updateItem('user-1', 'item-30', { note: 'nova nota' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.humidorItem.update).not.toHaveBeenCalled();
    });

    it('permite editar item dentro dos 25 mais antigos mesmo para usuário free', async () => {
      entitlements.resolveForUser.mockResolvedValue(freeSnapshot);
      prisma.humidorItem.findFirst.mockResolvedValue({ id: 'item-1', acquiredAt: new Date('2026-01-01') });
      prisma.humidorItem.count.mockResolvedValue(1); // rank 1: dentro do limite
      prisma.humidorItem.update.mockResolvedValue({ id: 'item-1' });

      await service.updateItem('user-1', 'item-1', { note: 'nova nota' });

      expect(prisma.humidorItem.update).toHaveBeenCalled();
    });
  });
});
