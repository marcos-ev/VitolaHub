import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueName } from '../queue/queue.constants';
import { CursorPage, DEFAULT_PAGE_SIZE, decodeCursor, paginateResults } from '../common/pagination/cursor.util';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  actorId?: string;
  entityType?: string;
  entityId?: string;
}

/**
 * Fonte única de criação de notificações in-app. Grava a linha e enfileira o
 * envio de push (fila `notifications`) — o processor que consome essa fila
 * (Expo Notifications) é implementado no módulo de feed/notificações
 * (Fase 1), mantendo este serviço estável para qualquer módulo que precise
 * notificar (auth/convites, follows, likes/comentários, chat de lojas, trial).
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QueueName.NOTIFICATIONS) private readonly queue: Queue,
  ) {}

  async create(input: CreateNotificationInput) {
    // Evita duplicar notificação de solicitação de amizade repetida em curto prazo.
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        actorId: input.actorId,
        entityType: input.entityType,
        entityId: input.entityId,
      },
    });

    await this.queue.add('PUSH_NOTIFICATION', { notificationId: notification.id }, { attempts: 3 });

    return notification;
  }

  async listForUser(userId: string, cursorRaw?: string): Promise<CursorPage<unknown>> {
    const cursor = decodeCursor(cursorRaw);
    const notifications = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: DEFAULT_PAGE_SIZE + 1,
      include: { actor: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });

    return paginateResults(notifications, DEFAULT_PAGE_SIZE);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    const notification = await this.prisma.notification.findFirst({ where: { id: notificationId, userId } });
    if (!notification) throw new NotFoundException('Notificação não encontrada');
    if (notification.readAt) return;
    await this.prisma.notification.update({ where: { id: notificationId }, data: { readAt: new Date() } });
  }

  async setPushToken(userId: string, expoPushToken: string | null): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { expoPushToken } });
  }
}
