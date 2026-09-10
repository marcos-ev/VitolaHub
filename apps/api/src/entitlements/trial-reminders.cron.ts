import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailQueueService } from '../mailer/email-queue.service';

function dateOnlyUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Lembretes de trial (seção 6.3): roda 1x/dia.
 *  - Dia 5 de um trial de 7 dias (2 dias antes de `trialEndsAt`): notifica +
 *    enfileira e-mail, uma única vez por dia (checa se já notificou hoje).
 *  - `trialEndsAt` já passado e `subscriptionStatus` ainda `TRIALING`:
 *    expira o trial (`subscriptionStatus: 'NONE'`), invalida o cache de
 *    entitlements e notifica.
 */
@Injectable()
export class TrialRemindersCron {
  private readonly logger = new Logger(TrialRemindersCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly notifications: NotificationsService,
    private readonly emailQueue: EmailQueueService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async run(): Promise<void> {
    await this.notifyTrialsEndingSoon();
    await this.expireEndedTrials();
  }

  private async notifyTrialsEndingSoon(): Promise<void> {
    const targetDate = new Date();
    targetDate.setUTCDate(targetDate.getUTCDate() + 2);
    const targetDateStr = dateOnlyUtc(targetDate);
    const todayStart = startOfTodayUtc();

    const trialingUsers = await this.prisma.user.findMany({
      where: { subscriptionStatus: 'TRIALING', trialEndsAt: { not: null }, deletedAt: null },
      select: { id: true, email: true, displayName: true, trialEndsAt: true },
    });

    const endingSoon = trialingUsers.filter((user) => dateOnlyUtc(user.trialEndsAt!) === targetDateStr);

    for (const user of endingSoon) {
      const alreadyNotifiedToday = await this.prisma.notification.findFirst({
        where: { userId: user.id, type: 'TRIAL_ENDING', createdAt: { gte: todayStart } },
        select: { id: true },
      });
      if (alreadyNotifiedToday) continue;

      await this.notifications.create({ userId: user.id, type: 'TRIAL_ENDING' });
      await this.emailQueue.enqueue({
        to: user.email,
        subject: 'Seu teste grátis do Vitola Hub termina em 2 dias',
        html: `<p>Olá, ${user.displayName}! Seu período de teste Premium termina em 2 dias. Assine para não perder o acesso.</p>`,
        text: `Olá, ${user.displayName}! Seu período de teste Premium termina em 2 dias. Assine para não perder o acesso.`,
      });
    }

    this.logger.log(`Lembretes de trial terminando: ${endingSoon.length} usuário(s) processado(s).`);
  }

  private async expireEndedTrials(): Promise<void> {
    const now = new Date();
    const expiredUsers = await this.prisma.user.findMany({
      where: { subscriptionStatus: 'TRIALING', trialEndsAt: { lt: now }, deletedAt: null },
      select: { id: true },
    });

    for (const user of expiredUsers) {
      await this.prisma.user.update({ where: { id: user.id }, data: { subscriptionStatus: 'NONE' } });
      await this.cache.del(`entitlements:${user.id}`);
      await this.notifications.create({ userId: user.id, type: 'TRIAL_EXPIRED' });
    }

    this.logger.log(`Trials expirados: ${expiredUsers.length} usuário(s) processado(s).`);
  }
}
