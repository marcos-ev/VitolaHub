import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { DomainEventsService } from '../../queue/domain-events.service';
import { DomainEvent } from '../../queue/queue.constants';
import { AdminCigarsService } from './admin-cigars.service';

describe('AdminCigarsService', () => {
  let service: AdminCigarsService;
  let prisma: {
    cigar: { findFirst: jest.Mock; findMany: jest.Mock; update: jest.Mock };
  };
  let notifications: { create: jest.Mock };
  let domainEvents: { publish: jest.Mock };

  beforeEach(async () => {
    prisma = {
      cigar: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    };
    notifications = { create: jest.fn() };
    domainEvents = { publish: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminCigarsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: DomainEventsService, useValue: domainEvents },
      ],
    }).compile();

    service = moduleRef.get(AdminCigarsService);
  });

  describe('approve', () => {
    it('lança NotFoundException quando o charuto não existe', async () => {
      prisma.cigar.findFirst.mockResolvedValue(null);

      await expect(service.approve('cigar-1')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.cigar.update).not.toHaveBeenCalled();
    });

    it('aprova, publica CIGAR_SUGGESTION_APPROVED e notifica quem sugeriu', async () => {
      prisma.cigar.findFirst.mockResolvedValue({ id: 'cigar-1', suggestedBy: 'user-1', status: 'PENDING' });
      prisma.cigar.update.mockResolvedValue({ id: 'cigar-1', status: 'APPROVED' });

      const result = await service.approve('cigar-1');

      expect(prisma.cigar.update).toHaveBeenCalledWith({ where: { id: 'cigar-1' }, data: { status: 'APPROVED' } });
      expect(domainEvents.publish).toHaveBeenCalledWith(DomainEvent.CIGAR_SUGGESTION_APPROVED, {
        userId: 'user-1',
        cigarId: 'cigar-1',
      });
      expect(notifications.create).toHaveBeenCalledWith({
        userId: 'user-1',
        type: NotificationType.INVITE_ACCEPTED,
        entityType: 'CIGAR',
        entityId: 'cigar-1',
      });
      expect(result).toEqual({ id: 'cigar-1', status: 'APPROVED' });
    });

    it('não publica evento nem notifica quando o charuto não tem suggestedBy (import direto)', async () => {
      prisma.cigar.findFirst.mockResolvedValue({ id: 'cigar-2', suggestedBy: null, status: 'PENDING' });
      prisma.cigar.update.mockResolvedValue({ id: 'cigar-2', status: 'APPROVED' });

      await service.approve('cigar-2');

      expect(domainEvents.publish).not.toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    it('lança NotFoundException quando o charuto não existe', async () => {
      prisma.cigar.findFirst.mockResolvedValue(null);

      await expect(service.reject('cigar-1', {})).rejects.toBeInstanceOf(NotFoundException);
    });

    it('marca o charuto como REJECTED', async () => {
      prisma.cigar.findFirst.mockResolvedValue({ id: 'cigar-1' });
      prisma.cigar.update.mockResolvedValue({ id: 'cigar-1', status: 'REJECTED' });

      const result = await service.reject('cigar-1', { reason: 'dados incompletos' });

      expect(prisma.cigar.update).toHaveBeenCalledWith({ where: { id: 'cigar-1' }, data: { status: 'REJECTED' } });
      expect(result).toEqual({ id: 'cigar-1', status: 'REJECTED' });
    });
  });

  describe('update', () => {
    it('atualiza somente os campos informados', async () => {
      prisma.cigar.findFirst.mockResolvedValue({ id: 'cigar-1' });
      prisma.cigar.update.mockResolvedValue({ id: 'cigar-1', name: 'Novo Nome' });

      await service.update('cigar-1', { name: 'Novo Nome', ringGauge: 50 });

      expect(prisma.cigar.update).toHaveBeenCalledWith({
        where: { id: 'cigar-1' },
        data: { name: 'Novo Nome', ringGauge: 50 },
      });
    });
  });
});
