import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminShopsService } from './admin-shops.service';

describe('AdminShopsService', () => {
  let service: AdminShopsService;
  let prisma: {
    user: { findFirst: jest.Mock };
    shop: { findUnique: jest.Mock; findFirst: jest.Mock; create: jest.Mock; update: jest.Mock; findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      user: { findFirst: jest.fn() },
      shop: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [AdminShopsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(AdminShopsService);
  });

  describe('assistedSignup', () => {
    const dto = {
      userId: 'user-1',
      cnpj: '12345678000199',
      tradeName: 'Charutaria Central',
      address: 'Rua X, 123',
      lat: -23.5,
      lng: -46.6,
    };

    it('lança NotFoundException quando o usuário não existe', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.assistedSignup(dto as never)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.shop.create).not.toHaveBeenCalled();
    });

    it('lança BadRequestException quando o usuário não é PJ', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1', accountType: 'PF' });

      await expect(service.assistedSignup(dto as never)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.shop.create).not.toHaveBeenCalled();
    });

    it('lança ConflictException quando o usuário já tem uma loja', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1', accountType: 'PJ' });
      prisma.shop.findUnique.mockResolvedValue({ id: 'shop-existing' });

      await expect(service.assistedSignup(dto as never)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.shop.create).not.toHaveBeenCalled();
    });

    it('cria a loja com plan=TRIAL e isVerified=false', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1', accountType: 'PJ' });
      prisma.shop.findUnique.mockResolvedValue(null);
      prisma.shop.create.mockResolvedValue({ id: 'shop-1', plan: 'TRIAL', isVerified: false });

      const result = await service.assistedSignup(dto as never);

      expect(prisma.shop.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          plan: 'TRIAL',
          isVerified: false,
        }),
      });
      expect(result).toEqual({ id: 'shop-1', plan: 'TRIAL', isVerified: false });
    });
  });

  describe('verify', () => {
    it('lança NotFoundException quando a loja não existe', async () => {
      prisma.shop.findFirst.mockResolvedValue(null);

      await expect(service.verify('shop-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('marca isVerified=true', async () => {
      prisma.shop.findFirst.mockResolvedValue({ id: 'shop-1' });
      prisma.shop.update.mockResolvedValue({ id: 'shop-1', isVerified: true });

      const result = await service.verify('shop-1');

      expect(prisma.shop.update).toHaveBeenCalledWith({ where: { id: 'shop-1' }, data: { isVerified: true } });
      expect(result).toEqual({ id: 'shop-1', isVerified: true });
    });
  });

  describe('list', () => {
    it('aplica filtros de plan e isVerified', async () => {
      prisma.shop.findMany.mockResolvedValue([]);

      await service.list({ plan: 'ACTIVE', isVerified: 'true' } as never);

      expect(prisma.shop.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ plan: 'ACTIVE', isVerified: true }),
        }),
      );
    });
  });
});
