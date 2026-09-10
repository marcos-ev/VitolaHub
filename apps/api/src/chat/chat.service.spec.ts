import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailQueueService } from '../mailer/email-queue.service';
import { QueueName } from '../queue/queue.constants';
import { ChatEventsService } from './chat-events.service';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  let service: ChatService;
  let prisma: {
    shop: { findFirst: jest.Mock };
    conversation: { findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    message: { findMany: jest.Mock; updateMany: jest.Mock };
    shopLead: { updateMany: jest.Mock };
    user: { findUnique: jest.Mock };
    report: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let tx: {
    conversation: { create: jest.Mock; update: jest.Mock };
    shopLead: { create: jest.Mock };
    message: { create: jest.Mock };
  };
  let notifications: { create: jest.Mock };
  let emailQueue: { enqueue: jest.Mock };
  let chatEvents: { emitMessageNew: jest.Mock; emitMessageRead: jest.Mock; setServer: jest.Mock };
  let chatQueue: { add: jest.Mock; getJob: jest.Mock };

  const shop = {
    id: 'shop-1',
    userId: 'shop-owner-1',
    tradeName: 'Charutaria do Zé',
    greetingMessage: null as string | null,
    deletedAt: null,
  };

  const conversationWithShop = {
    id: 'conv-1',
    shopId: 'shop-1',
    userId: 'user-1',
    status: 'OPEN',
    lastMessageAt: new Date('2026-08-01T10:00:00Z'),
    createdAt: new Date('2026-08-01T09:00:00Z'),
    shop: { ...shop, user: { id: 'shop-owner-1', email: 'loja@example.com', displayName: 'Zé' } },
  };

  beforeEach(async () => {
    tx = {
      conversation: { create: jest.fn(), update: jest.fn() },
      shopLead: { create: jest.fn() },
      message: { create: jest.fn() },
    };
    prisma = {
      shop: { findFirst: jest.fn() },
      conversation: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      message: { findMany: jest.fn(), updateMany: jest.fn() },
      shopLead: { updateMany: jest.fn() },
      user: { findUnique: jest.fn() },
      report: { create: jest.fn() },
      $transaction: jest.fn().mockImplementation((cb: (tx: unknown) => unknown) => cb(tx)),
    };
    notifications = { create: jest.fn() };
    emailQueue = { enqueue: jest.fn() };
    chatEvents = { emitMessageNew: jest.fn(), emitMessageRead: jest.fn(), setServer: jest.fn() };
    chatQueue = { add: jest.fn(), getJob: jest.fn().mockResolvedValue(null) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: EmailQueueService, useValue: emailQueue },
        { provide: ChatEventsService, useValue: chatEvents },
        { provide: getQueueToken(QueueName.CHAT), useValue: chatQueue },
      ],
    }).compile();

    service = moduleRef.get(ChatService);
  });

  describe('openConversation', () => {
    it('lança NotFoundException quando a loja não existe', async () => {
      prisma.shop.findFirst.mockResolvedValue(null);
      await expect(service.openConversation('user-1', { shopId: 'shop-x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('lança BadRequestException quando a própria dona da loja tenta abrir conversa consigo mesma', async () => {
      prisma.shop.findFirst.mockResolvedValue(shop);
      await expect(service.openConversation('shop-owner-1', { shopId: 'shop-1' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('cria a conversa e o ShopLead vinculado na primeira abertura (rastreabilidade)', async () => {
      prisma.shop.findFirst.mockResolvedValue(shop);
      prisma.conversation.findUnique.mockResolvedValue(null);
      tx.conversation.create.mockResolvedValue({
        id: 'conv-1',
        shopId: 'shop-1',
        userId: 'user-1',
        lastMessageAt: new Date(),
        status: 'OPEN',
        createdAt: new Date(),
      });

      const result = await service.openConversation('user-1', { shopId: 'shop-1' });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ shopId: 'shop-1', userId: 'user-1' }) }),
      );
      expect(tx.shopLead.create).toHaveBeenCalledWith({
        data: { shopId: 'shop-1', userId: 'user-1', conversationId: 'conv-1', source: 'chat', status: 'OPEN' },
      });
      expect(result.id).toBe('conv-1');
    });

    it('é idempotente: retorna a conversa existente em vez de duplicar quando já há uma para o par loja+usuário', async () => {
      prisma.shop.findFirst.mockResolvedValue(shop);
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-existing',
        shopId: 'shop-1',
        userId: 'user-1',
        status: 'OPEN',
        lastMessageAt: new Date(),
        createdAt: new Date(),
      });

      const result = await service.openConversation('user-1', { shopId: 'shop-1' });

      expect(result.id).toBe('conv-existing');
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.shopLead.create).not.toHaveBeenCalled();
    });

    it('envia a mensagem de saudação automática como primeira Message quando a loja tem greetingMessage configurada', async () => {
      const shopWithGreeting = { ...shop, greetingMessage: 'Olá! Como posso ajudar?' };
      prisma.shop.findFirst.mockResolvedValue(shopWithGreeting);
      prisma.conversation.findUnique.mockResolvedValue(null);
      tx.conversation.create.mockResolvedValue({
        id: 'conv-1',
        shopId: 'shop-1',
        userId: 'user-1',
        lastMessageAt: new Date(),
        status: 'OPEN',
        createdAt: new Date(),
      });
      tx.message.create.mockResolvedValue({ id: 'msg-1', createdAt: new Date() });
      tx.conversation.update.mockResolvedValue({
        id: 'conv-1',
        shopId: 'shop-1',
        userId: 'user-1',
        lastMessageAt: new Date(),
        status: 'OPEN',
        createdAt: new Date(),
      });

      await service.openConversation('user-1', { shopId: 'shop-1' });

      expect(tx.message.create).toHaveBeenCalledWith({
        data: {
          conversationId: 'conv-1',
          senderType: 'SHOP',
          senderId: 'shop-owner-1',
          body: 'Olá! Como posso ajudar?',
        },
      });
    });
  });

  describe('sendMessage — autorização', () => {
    it('lança NotFoundException quando a conversa não existe', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null);
      await expect(service.sendMessage('user-1', 'conv-x', { body: 'oi' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('lança ForbiddenException quando quem envia não é nem o usuário nem a dona da loja', async () => {
      prisma.conversation.findUnique.mockResolvedValue(conversationWithShop);
      await expect(service.sendMessage('outro-usuario', 'conv-1', { body: 'oi' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('permite que o usuário da conversa envie mensagem, notifica e agenda o lembrete de 2h', async () => {
      prisma.conversation.findUnique.mockResolvedValue(conversationWithShop);
      prisma.user.findUnique.mockResolvedValue({ displayName: 'Fulano' });
      prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
        const localTx = { message: { create: jest.fn().mockResolvedValue({
          id: 'msg-1', conversationId: 'conv-1', senderType: 'USER', senderId: 'user-1', body: 'oi',
          readAt: null, createdAt: new Date(),
        }) }, conversation: { update: jest.fn() } };
        return cb(localTx);
      });

      const message = await service.sendMessage('user-1', 'conv-1', { body: 'oi' });

      expect(message.senderType).toBe('USER');
      expect(prisma.shopLead.updateMany).toHaveBeenCalledWith({
        where: { conversationId: 'conv-1' },
        data: { status: 'OPEN' },
      });
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'shop-owner-1', type: 'SHOP_MESSAGE', actorId: 'user-1' }),
      );
      expect(emailQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'loja@example.com' }),
      );
      expect(chatQueue.add).toHaveBeenCalledWith(
        'SHOP_REMINDER',
        { conversationId: 'conv-1' },
        expect.objectContaining({ delay: 2 * 60 * 60 * 1000, jobId: 'shop-reminder-conv-1' }),
      );
      expect(chatEvents.emitMessageNew).toHaveBeenCalledWith('conv-1', expect.objectContaining({ id: 'msg-1' }));
    });

    it('permite que a dona da loja envie mensagem, marca o lead como respondido e cancela o lembrete', async () => {
      prisma.conversation.findUnique.mockResolvedValue(conversationWithShop);
      const existingJob = { remove: jest.fn() };
      chatQueue.getJob.mockResolvedValue(existingJob);
      prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
        const localTx = { message: { create: jest.fn().mockResolvedValue({
          id: 'msg-2', conversationId: 'conv-1', senderType: 'SHOP', senderId: 'shop-owner-1', body: 'Olá!',
          readAt: null, createdAt: new Date(),
        }) }, conversation: { update: jest.fn() } };
        return cb(localTx);
      });

      const message = await service.sendMessage('shop-owner-1', 'conv-1', { body: 'Olá!' });

      expect(message.senderType).toBe('SHOP');
      expect(prisma.shopLead.updateMany).toHaveBeenCalledWith({
        where: { conversationId: 'conv-1' },
        data: { status: 'RESPONDED' },
      });
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', type: 'SHOP_MESSAGE', actorId: 'shop-owner-1' }),
      );
      expect(emailQueue.enqueue).not.toHaveBeenCalled();
      expect(existingJob.remove).toHaveBeenCalled();
      expect(chatQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('reportConversation', () => {
    it('só permite denúncia de quem participa da conversa', async () => {
      prisma.conversation.findUnique.mockResolvedValue(conversationWithShop);
      await expect(service.reportConversation('conv-1', 'estranho', 'spam')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.report.create).not.toHaveBeenCalled();
    });

    it('cria a denúncia quando o reportante é participante (usuário ou loja)', async () => {
      prisma.conversation.findUnique.mockResolvedValue(conversationWithShop);
      await service.reportConversation('conv-1', 'user-1', 'comportamento abusivo');
      expect(prisma.report.create).toHaveBeenCalledWith({
        data: { reporterId: 'user-1', entityType: 'CONVERSATION', entityId: 'conv-1', reason: 'comportamento abusivo' },
      });
    });
  });
});
