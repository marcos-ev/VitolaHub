import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminModerationService } from './admin-moderation.service';

describe('AdminModerationService', () => {
  let service: AdminModerationService;
  let prisma: {
    report: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    post: { findFirst: jest.Mock; update: jest.Mock };
    user: { findFirst: jest.Mock; update: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      report: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      post: { findFirst: jest.fn(), update: jest.fn() },
      user: { findFirst: jest.fn(), update: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [AdminModerationService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(AdminModerationService);
  });

  it('lista denúncias paginadas por cursor, aplicando filtros de status/entityType', async () => {
    prisma.report.findMany.mockResolvedValue([]);

    await service.listReports({ status: 'OPEN', entityType: 'POST' } as never);

    expect(prisma.report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'OPEN', entityType: 'POST' }),
      }),
    );
  });

  it('resolve grava status REVIEWED', async () => {
    prisma.report.findUnique.mockResolvedValue({ id: 'report-1' });
    prisma.report.update.mockResolvedValue({ id: 'report-1', status: 'REVIEWED' });

    const result = await service.resolve('report-1');

    expect(prisma.report.update).toHaveBeenCalledWith({ where: { id: 'report-1' }, data: { status: 'REVIEWED' } });
    expect(result).toEqual({ id: 'report-1', status: 'REVIEWED' });
  });

  it('dismiss grava status DISMISSED', async () => {
    prisma.report.findUnique.mockResolvedValue({ id: 'report-1' });
    prisma.report.update.mockResolvedValue({ id: 'report-1', status: 'DISMISSED' });

    await service.dismiss('report-1');

    expect(prisma.report.update).toHaveBeenCalledWith({ where: { id: 'report-1' }, data: { status: 'DISMISSED' } });
  });

  it('resolve lança NotFoundException quando a denúncia não existe', async () => {
    prisma.report.findUnique.mockResolvedValue(null);

    await expect(service.resolve('report-x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removePost faz soft delete (deletedAt) do post denunciado', async () => {
    prisma.post.findFirst.mockResolvedValue({ id: 'post-1', deletedAt: null });
    prisma.post.update.mockResolvedValue({ id: 'post-1', deletedAt: new Date() });

    await service.removePost('post-1');

    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('suspendUser muda status para SUSPENDED', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
    prisma.user.update.mockResolvedValue({ id: 'user-1', status: 'SUSPENDED' });

    await service.suspendUser('user-1');

    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { status: 'SUSPENDED' } });
  });

  it('unsuspendUser muda status para ACTIVE', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
    prisma.user.update.mockResolvedValue({ id: 'user-1', status: 'ACTIVE' });

    await service.unsuspendUser('user-1');

    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { status: 'ACTIVE' } });
  });
});
