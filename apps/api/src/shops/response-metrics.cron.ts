import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface ResponseMetricRow {
  shop_id: string;
  avg_response_seconds: number | null;
  response_rate: number | null;
}

/**
 * Recalcula `Shop.avgResponseSeconds`/`Shop.responseRate` periodicamente
 * (seção 5.6): esses indicadores NUNCA são calculados em tempo de leitura,
 * só lidos prontos em `ShopsService.getById`/`searchNearby`.
 *
 * Definições usadas (sobre uma janela móvel dos últimos 30 dias):
 *  - `avgResponseSeconds`: média do tempo entre a primeira mensagem `USER`
 *    de cada conversa e a primeira resposta `SHOP` subsequente.
 *  - `responseRate`: percentual dessas conversas em que a loja respondeu
 *    dentro de 24h da primeira mensagem do usuário.
 * Lojas sem nenhuma conversa com mensagem de usuário no período têm os dois
 * campos resetados para `null` (indicador "sem dados suficientes"), em vez
 * de manter um valor desatualizado de janelas anteriores.
 */
@Injectable()
export class ResponseMetricsCron {
  private readonly logger = new Logger(ResponseMetricsCron.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    const { shopsUpdated } = await this.recompute();
    this.logger.log(`Métricas de resposta recalculadas para ${shopsUpdated} loja(s).`);
  }

  async recompute(): Promise<{ shopsUpdated: number }> {
    const rows = await this.prisma.$queryRaw<ResponseMetricRow[]>`
      WITH first_user_message AS (
        SELECT DISTINCT ON (m.conversation_id)
          m.conversation_id, c.shop_id, m.created_at AS user_at
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
        WHERE m.sender_type = 'USER'
          AND m.created_at >= now() - interval '30 days'
        ORDER BY m.conversation_id, m.created_at ASC
      ),
      with_reply AS (
        SELECT
          fum.conversation_id,
          fum.shop_id,
          fum.user_at,
          (
            SELECT MIN(reply.created_at)
            FROM messages reply
            WHERE reply.conversation_id = fum.conversation_id
              AND reply.sender_type = 'SHOP'
              AND reply.created_at > fum.user_at
          ) AS shop_at
        FROM first_user_message fum
      )
      SELECT
        shop_id,
        AVG(EXTRACT(EPOCH FROM (shop_at - user_at)))::float AS avg_response_seconds,
        (
          COUNT(*) FILTER (WHERE shop_at IS NOT NULL AND shop_at <= user_at + interval '24 hours')
        )::float / NULLIF(COUNT(*), 0)::float * 100 AS response_rate
      FROM with_reply
      GROUP BY shop_id
    `;

    const shopIdsWithData = rows.map((row) => row.shop_id);

    await this.prisma.shop.updateMany({
      where: shopIdsWithData.length
        ? { id: { notIn: shopIdsWithData }, deletedAt: null }
        : { deletedAt: null },
      data: { avgResponseSeconds: null, responseRate: null },
    });

    for (const row of rows) {
      await this.prisma.shop.update({
        where: { id: row.shop_id },
        data: {
          avgResponseSeconds:
            row.avg_response_seconds != null ? Math.round(Number(row.avg_response_seconds)) : null,
          responseRate:
            row.response_rate != null
              ? new Prisma.Decimal(Number(row.response_rate).toFixed(2))
              : null,
        },
      });
    }

    return { shopsUpdated: rows.length };
  }
}
