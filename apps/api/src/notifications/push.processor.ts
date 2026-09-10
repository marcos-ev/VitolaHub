import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueName } from '../queue/queue.constants';

function buildMessage(type: NotificationType, actorName: string | null): { title: string; body: string } {
  switch (type) {
    case 'FOLLOW_REQUEST':
      return { title: 'Novo pedido para seguir', body: `${actorName ?? 'Alguém'} quer te seguir` };
    case 'FOLLOW_ACCEPTED':
      return { title: 'Pedido aceito', body: `${actorName ?? 'Alguém'} aceitou seu pedido para seguir` };
    case 'LIKE':
      return { title: 'Nova curtida', body: `${actorName ?? 'Alguém'} curtiu sua publicação` };
    case 'COMMENT':
      return { title: 'Novo comentário', body: `${actorName ?? 'Alguém'} comentou na sua publicação` };
    case 'ACHIEVEMENT_UNLOCKED':
      return { title: 'Nova conquista!', body: 'Você desbloqueou uma nova conquista' };
    case 'TRIAL_ENDING':
      return { title: 'Seu teste está terminando', body: 'Seu período de teste premium está quase acabando' };
    case 'TRIAL_EXPIRED':
      return { title: 'Seu teste terminou', body: 'Seu período de teste premium expirou' };
    case 'SHOP_MESSAGE':
      return { title: 'Nova mensagem', body: `${actorName ?? 'Uma charutaria'} te enviou uma mensagem` };
    case 'INVITE_ACCEPTED':
      return { title: 'Convite aceito', body: `${actorName ?? 'Alguém'} aceitou seu convite` };
    default:
      return { title: 'Vitola Hub', body: 'Você tem uma nova notificação' };
  }
}

/**
 * Consome a fila `notifications` (job `PUSH_NOTIFICATION`, enfileirado por
 * `NotificationsService.create`) e envia o push via Expo. Se o destinatário
 * não tiver `expoPushToken` (ou o token for inválido), apenas ignora — não é
 * erro, é o caso comum de usuário sem app instalado/permissão negada.
 */
@Processor(QueueName.NOTIFICATIONS)
export class PushProcessor extends WorkerHost {
  private readonly expo = new Expo();

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<{ notificationId: string }>): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: job.data.notificationId },
      include: {
        user: { select: { expoPushToken: true } },
        actor: { select: { displayName: true } },
      },
    });
    if (!notification) return;

    const pushToken = notification.user.expoPushToken;
    if (!pushToken || !Expo.isExpoPushToken(pushToken)) return;

    const { title, body } = buildMessage(notification.type, notification.actor?.displayName ?? null);

    const message: ExpoPushMessage = {
      to: pushToken,
      sound: 'default',
      title,
      body,
      data: {
        type: notification.type,
        entityType: notification.entityType,
        entityId: notification.entityId,
        notificationId: notification.id,
      },
    };

    const chunks = this.expo.chunkPushNotifications([message]);
    for (const chunk of chunks) {
      await this.expo.sendPushNotificationsAsync(chunk);
    }
  }
}
