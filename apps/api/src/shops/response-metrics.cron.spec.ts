import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ResponseMetricsCron } from './response-metrics.cron';

describe('ResponseMetricsCron', () => {
  let cron: ResponseMetricsCron;
  let prisma: {
    $queryRaw: jest.Mock;
    shop: { updateMany: jest.Mock; update: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn(),
      shop: { updateMany: jest.fn(), update: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [ResponseMetricsCron, { provide: PrismaService, useValue: prisma }],
    }).compile();

    cron = moduleRef.get(ResponseMetricsCron);
  });

  it('recalcula avgResponseSeconds/responseRate por loja a partir da query agregada', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { shop_id: 'shop-1', avg_response_seconds: 1800.4, response_rate: 87.5 },
      { shop_id: 'shop-2', avg_response_seconds: 300, response_rate: 100 },
    ]);

    const result = await cron.recompute();

    expect(result.shopsUpdated).toBe(2);
    expect(prisma.shop.update).toHaveBeenCalledTimes(2);

    const firstCallData = prisma.shop.update.mock.calls[0][0];
    expect(firstCallData.where).toEqual({ id: 'shop-1' });
    expect(firstCallData.data.avgResponseSeconds).toBe(1800);
    expect(firstCallData.data.responseRate.toString()).toBe('87.5');
  });

  it('reseta para null apenas as lojas sem conversas recentes com resposta, preservando as demais', async () => {
    prisma.$queryRaw.mockResolvedValue([{ shop_id: 'shop-1', avg_response_seconds: 600, response_rate: 100 }]);

    await cron.recompute();

    expect(prisma.shop.updateMany).toHaveBeenCalledWith({
      where: { id: { notIn: ['shop-1'] }, deletedAt: null },
      data: { avgResponseSeconds: null, responseRate: null },
    });
  });

  it('reseta todas as lojas quando não há nenhuma conversa com mensagem de usuário nos últimos 30 dias', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    const result = await cron.recompute();

    expect(result.shopsUpdated).toBe(0);
    expect(prisma.shop.updateMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      data: { avgResponseSeconds: null, responseRate: null },
    });
    expect(prisma.shop.update).not.toHaveBeenCalled();
  });
});
