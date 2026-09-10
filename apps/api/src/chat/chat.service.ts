import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Conversation, Prisma, SenderType, Shop } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailQueueService } from '../mailer/email-queue.service';
import { QueueName } from '../queue/queue.constants';
import { CursorPage, DEFAULT_PAGE_SIZE, decodeCursor, paginateResults } from '../common/pagination/cursor.util';
import { ChatEventsService } from './chat-events.service';
import { OpenConversationDto } from './dto/open-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
export const SHOP_REMINDER_JOB = 'SHOP_REMINDER';

type ConversationWithShopUser = Conversation & {
  shop: Shop & { user: { id: string; email: string; displayName: string } };
};

type Role = 'USER' | 'SHOP';

interface ConversationCursor {
  lastMessageAt: string;
  id: string;
}

function encodeConversationCursor(lastMessageAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ lastMessageAt: lastMessageAt.toISOString(), id })).toString('base64url');
}

function decodeConversationCursor(cursor: string | undefined | null): ConversationCursor | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as ConversationCursor;
    if (!parsed.lastMessageAt || !parsed.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Chat interno loja↔usuário (seção 5.6). Fonte única de verdade para as
 * duas entradas (REST de fallback e WebSocket `ChatGateway`): ambas chamam
 * exatamente estes métodos, garantindo que autorização, notificação,
 * e-mail e lembrete de 2h nunca fiquem duplicados ou divergentes entre os
 * dois transportes.
 */
@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly emailQueue: EmailQueueService,
    private readonly chatEvents: ChatEventsService,
    @InjectQueue(QueueName.CHAT) private readonly chatQueue: Queue,
  ) {}

  /**
   * Abre (ou recupera) a conversa do usuário atual com uma loja. Idempotente
   * via `@@unique([shopId, userId])`: nunca duplica. Cria o `ShopLead`
   * automaticamente na primeira abertura, vinculado à conversa (100% de
   * rastreabilidade, conforme o enunciado). `lastMessageAt` é sempre
   * inicializado (na criação, ou pela mensagem de saudação quando houver)
   * em vez de deixado `null`, o que simplifica a ordenação de
   * `listConversations` sem precisar tratar NULLS FIRST/LAST no Postgres.
   */
  async openConversation(userId: string, dto: OpenConversationDto) {
    const shop = await this.prisma.shop.findFirst({ where: { id: dto.shopId, deletedAt: null } });
    if (!shop) throw new NotFoundException('Loja não encontrada');
    if (shop.userId === userId) {
      throw new BadRequestException('A loja não pode abrir uma conversa consigo mesma');
    }

    const existing = await this.prisma.conversation.findUnique({
      where: { shopId_userId: { shopId: dto.shopId, userId } },
    });
    if (existing) return this.toConversationDto(existing, shop);

    const now = new Date();
    const conversation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.conversation.create({
        data: { shopId: dto.shopId, userId, lastMessageAt: now },
      });
      await tx.shopLead.create({
        data: { shopId: dto.shopId, userId, conversationId: created.id, source: 'chat', status: 'OPEN' },
      });

      if (shop.greetingMessage) {
        const greeting = await tx.message.create({
          data: {
            conversationId: created.id,
            senderType: 'SHOP',
            senderId: shop.userId,
            body: shop.greetingMessage,
          },
        });
        const updated = await tx.conversation.update({
          where: { id: created.id },
          data: { lastMessageAt: greeting.createdAt },
        });
        return updated;
      }

      return created;
    });

    return this.toConversationDto(conversation, shop);
  }

  /**
   * Lista as conversas do usuário atual — como cliente (usuário comum) OU
   * como dono de loja (detectado via `Shop.userId = currentUser.id`). Um
   * mesmo usuário nunca é as duas coisas ao mesmo tempo nesta fase (só lojas
   * PJ têm `Shop`), então a detecção é suficiente sem parâmetro extra.
   */
  async listConversations(userId: string, cursorRaw?: string): Promise<CursorPage<unknown>> {
    const shop = await this.prisma.shop.findFirst({ where: { userId, deletedAt: null } });
    const cursor = decodeConversationCursor(cursorRaw);
    const viewerRole: Role = shop ? 'SHOP' : 'USER';

    const scopeFilter: Prisma.ConversationWhereInput = shop ? { shopId: shop.id } : { userId };
    const cursorFilter: Prisma.ConversationWhereInput = cursor
      ? {
          OR: [
            { lastMessageAt: { lt: new Date(cursor.lastMessageAt) } },
            { lastMessageAt: new Date(cursor.lastMessageAt), id: { lt: cursor.id } },
          ],
        }
      : {};

    const conversations = await this.prisma.conversation.findMany({
      where: { ...scopeFilter, ...cursorFilter },
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      take: DEFAULT_PAGE_SIZE + 1,
      include: {
        shop: { select: { id: true, tradeName: true, userId: true } },
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });

    const hasMore = conversations.length > DEFAULT_PAGE_SIZE;
    const page = hasMore ? conversations.slice(0, DEFAULT_PAGE_SIZE) : conversations;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last ? encodeConversationCursor(last.lastMessageAt ?? last.createdAt, last.id) : null;

    return {
      items: page.map((conversation) => ({
        id: conversation.id,
        status: conversation.status,
        lastMessageAt: conversation.lastMessageAt,
        createdAt: conversation.createdAt,
        shop: { id: conversation.shop.id, tradeName: conversation.shop.tradeName },
        user: conversation.user,
        viewerRole,
      })),
      nextCursor,
    };
  }

  /**
   * Histórico paginado por cursor. Ordem escolhida: mais recentes primeiro
   * (createdAt desc), igual ao padrão do resto da API (`cursor.util`) — o
   * cliente que quiser exibir em ordem cronológica inverte a lista
   * localmente antes de renderizar (padrão comum em apps de chat que
   * carregam a partir do fim e paginam "para cima").
   */
  async listMessages(userId: string, conversationId: string, cursorRaw?: string) {
    const conversation = await this.getConversationOrThrow(conversationId);
    this.resolveRole(conversation, userId);

    const cursor = decodeCursor(cursorRaw);
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
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
    });

    const page = paginateResults(messages, DEFAULT_PAGE_SIZE);
    return { items: page.items.map((message) => this.toMessageDto(message)), nextCursor: page.nextCursor };
  }

  /**
   * Envia uma mensagem. Autoriza apenas os dois participantes da conversa
   * (`Conversation.userId` ou dono da `Shop`). Centraliza todos os efeitos
   * colaterais (notificação, e-mail, status do lead, lembrete de 2h e
   * emissão do evento `message:new`) para que REST e WebSocket tenham
   * exatamente o mesmo comportamento.
   */
  async sendMessage(userId: string, conversationId: string, dto: SendMessageDto) {
    const conversation = await this.getConversationOrThrow(conversationId);
    const { role } = this.resolveRole(conversation, userId);
    const senderType: SenderType = role;

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: { conversationId, senderType, senderId: userId, body: dto.body },
      });
      await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: created.createdAt } });
      return created;
    });

    if (senderType === 'USER') {
      await this.prisma.shopLead.updateMany({ where: { conversationId }, data: { status: 'OPEN' } });

      await this.notifications.create({
        userId: conversation.shop.userId,
        type: 'SHOP_MESSAGE',
        actorId: userId,
        entityType: 'CONVERSATION',
        entityId: conversationId,
      });

      const senderUser = await this.prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
      const senderName = senderUser?.displayName ?? 'um usuário';
      await this.emailQueue.enqueue({
        to: conversation.shop.user.email,
        subject: `Nova mensagem de ${senderName}`,
        html: `<p>Você recebeu uma nova mensagem de <strong>${senderName}</strong> no Vitola Hub:</p><p>"${dto.body}"</p>`,
        text: `Você recebeu uma nova mensagem de ${senderName}: "${dto.body}"`,
      });

      await this.scheduleReminder(conversationId);
    } else {
      await this.prisma.shopLead.updateMany({ where: { conversationId }, data: { status: 'RESPONDED' } });

      await this.notifications.create({
        userId: conversation.userId,
        type: 'SHOP_MESSAGE',
        actorId: userId,
        entityType: 'CONVERSATION',
        entityId: conversationId,
      });

      await this.cancelReminder(conversationId);
    }

    const messageDto = this.toMessageDto(message);
    this.chatEvents.emitMessageNew(conversationId, messageDto);
    return messageDto;
  }

  /** Marca como lidas as mensagens do outro lado da conversa. */
  async markRead(userId: string, conversationId: string) {
    const conversation = await this.getConversationOrThrow(conversationId);
    const { role } = this.resolveRole(conversation, userId);
    const opposingSenderType: SenderType = role === 'USER' ? 'SHOP' : 'USER';

    const now = new Date();
    const result = await this.prisma.message.updateMany({
      where: { conversationId, senderType: opposingSenderType, readAt: null },
      data: { readAt: now },
    });

    if (result.count > 0) {
      this.chatEvents.emitMessageRead(conversationId, { conversationId, readAt: now, readBy: role });
    }

    return { updated: result.count };
  }

  async reportConversation(conversationId: string, reporterId: string, reason: string) {
    await this.assertParticipant(reporterId, conversationId);
    return this.prisma.report.create({
      data: { reporterId, entityType: 'CONVERSATION', entityId: conversationId, reason },
    });
  }

  /** Usado pelo `ChatGateway` para autorizar a entrada na room da conversa. */
  async assertParticipant(userId: string, conversationId: string) {
    const conversation = await this.getConversationOrThrow(conversationId);
    this.resolveRole(conversation, userId);
    return conversation;
  }

  private async getConversationOrThrow(conversationId: string): Promise<ConversationWithShopUser> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { shop: { include: { user: { select: { id: true, email: true, displayName: true } } } } },
    });
    if (!conversation) throw new NotFoundException('Conversa não encontrada');
    return conversation as ConversationWithShopUser;
  }

  private resolveRole(conversation: ConversationWithShopUser, userId: string): { role: Role } {
    if (conversation.userId === userId) return { role: 'USER' };
    if (conversation.shop.userId === userId) return { role: 'SHOP' };
    throw new ForbiddenException('Você não participa desta conversa');
  }

  private toConversationDto(
    conversation: { id: string; shopId: string; userId: string; lastMessageAt: Date | null; status: string; createdAt: Date },
    shop: { id: string; tradeName: string },
  ) {
    return {
      id: conversation.id,
      shopId: conversation.shopId,
      shop: { id: shop.id, tradeName: shop.tradeName },
      userId: conversation.userId,
      status: conversation.status,
      lastMessageAt: conversation.lastMessageAt,
      createdAt: conversation.createdAt,
    };
  }

  private toMessageDto(message: {
    id: string;
    conversationId: string;
    senderType: SenderType;
    senderId: string;
    body: string;
    readAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderType: message.senderType,
      senderId: message.senderId,
      body: message.body,
      readAt: message.readAt,
      createdAt: message.createdAt,
    };
  }

  private reminderJobId(conversationId: string): string {
    // BullMQ não aceita ":" em IDs de job customizados (conflita com o
    // delimitador interno das chaves no Redis) — usamos "-" como separador.
    return `shop-reminder-${conversationId}`;
  }

  /**
   * Agenda o lembrete de 2h sem resposta via delay do BullMQ (mais simples
   * e preciso do que um cron de varredura a cada X minutos). `jobId` fixo
   * por conversa garante idempotência: uma nova mensagem do usuário
   * substitui (não duplica) o lembrete pendente, reiniciando a janela de 2h.
   */
  private async scheduleReminder(conversationId: string): Promise<void> {
    await this.cancelReminder(conversationId);
    await this.chatQueue.add(
      SHOP_REMINDER_JOB,
      { conversationId },
      { delay: TWO_HOURS_MS, jobId: this.reminderJobId(conversationId) },
    );
  }

  private async cancelReminder(conversationId: string): Promise<void> {
    const existing = await this.chatQueue.getJob(this.reminderJobId(conversationId));
    if (existing) await existing.remove();
  }
}
