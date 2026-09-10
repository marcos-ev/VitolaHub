import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { EmailQueueService } from '../../mailer/email-queue.service';
import { QueueName } from '../../queue/queue.constants';
import { SHOP_REMINDER_JOB } from '../chat.service';

// Horário comercial fixo (seção 5.6): 9h-18h em dias de semana, horário de
// São Paulo. Implementado como um deslocamento fixo de -3h a partir de UTC
// (o Brasil não usa mais horário de verão desde 2019), sem lib de fuso
// horário nova — simplificação suficiente para esta fase.
const SAO_PAULO_UTC_OFFSET_HOURS = 3;
const BUSINESS_HOUR_START = 9;
const BUSINESS_HOUR_END = 18;

function isBusinessHoursInSaoPaulo(date: Date): boolean {
  const spTime = new Date(date.getTime() - SAO_PAULO_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  const weekday = spTime.getUTCDay(); // 0=domingo .. 6=sábado (já deslocado para SP)
  const hour = spTime.getUTCHours();
  const isWeekday = weekday >= 1 && weekday <= 5;
  return isWeekday && hour >= BUSINESS_HOUR_START && hour < BUSINESS_HOUR_END;
}

/**
 * Worker do lembrete de 2h sem resposta (seção 5.6). O job é agendado com
 * `delay: 2h` por `ChatService.scheduleReminder` e cancelado (removido da
 * fila) assim que a loja responde — mas, por segurança, verificamos de novo
 * aqui se a última mensagem da conversa ainda é do usuário antes de
 * notificar (idempotência mesmo que o cancelamento falhe por qualquer
 * motivo). Fora do horário comercial, o lembrete é simplesmente descartado
 * nesta fase (não é reagendado para o próximo horário comercial) —
 * simplificação documentada no resumo da fase.
 */
@Processor(QueueName.CHAT)
export class ChatReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(ChatReminderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly emailQueue: EmailQueueService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== SHOP_REMINDER_JOB) return;

    const { conversationId } = job.data as { conversationId: string };
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        shop: { include: { user: { select: { id: true, email: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!conversation) return;

    const lastMessage = conversation.messages[0];
    if (!lastMessage || lastMessage.senderType !== 'USER') {
      // Loja já respondeu (ou não há mensagens) — nada a lembrar.
      return;
    }

    if (!isBusinessHoursInSaoPaulo(new Date())) {
      this.logger.log(`Lembrete da conversa ${conversationId} ignorado: fora do horário comercial.`);
      return;
    }

    await this.notifications.create({
      userId: conversation.shop.userId,
      type: 'SHOP_MESSAGE',
      entityType: 'CONVERSATION',
      entityId: conversationId,
    });

    await this.emailQueue.enqueue({
      to: conversation.shop.user.email,
      subject: 'Lembrete: você tem uma mensagem sem resposta há 2 horas',
      html: '<p>Um cliente enviou uma mensagem há 2 horas e ainda não recebeu resposta no Vitola Hub. Responda para não perder a venda!</p>',
      text: 'Um cliente enviou uma mensagem há 2 horas e ainda não recebeu resposta no Vitola Hub. Responda para não perder a venda!',
    });

    this.logger.log(`Lembrete de 2h enviado para a loja da conversa ${conversationId}.`);
  }
}
