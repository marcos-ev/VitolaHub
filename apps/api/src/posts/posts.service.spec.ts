import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { VisibilityService } from '../common/visibility/visibility.service';
import { MediaService } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CountersService } from '../queue/counters.service';
import { QueueName } from '../queue/queue.constants';
import { ReviewsService } from '../reviews/reviews.service';
import { PostsService } from './posts.service';

describe('PostsService', () => {
  let service: PostsService;
  let prisma: {
    cigar: { findFirst: jest.Mock };
    post: { create: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    like: { upsert: jest.Mock; deleteMany: jest.Mock };
    comment: { findFirst: jest.Mock; create: jest.Mock };
  };
  let visibility: { canViewPost: jest.Mock };
  let counters: { recomputePostLikeCount: jest.Mock; recomputePostCommentCount: jest.Mock };
  let notifications: { create: jest.Mock };
  let mediaQueue: { add: jest.Mock };

  beforeEach(async () => {
    prisma = {
      cigar: { findFirst: jest.fn() },
      post: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      like: { upsert: jest.fn(), deleteMany: jest.fn() },
      comment: { findFirst: jest.fn(), create: jest.fn() },
    };
    visibility = { canViewPost: jest.fn().mockResolvedValue(true) };
    counters = { recomputePostLikeCount: jest.fn(), recomputePostCommentCount: jest.fn() };
    notifications = { create: jest.fn() };
    mediaQueue = { add: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: PrismaService, useValue: prisma },
        { provide: VisibilityService, useValue: visibility },
        { provide: CountersService, useValue: counters },
        { provide: NotificationsService, useValue: notifications },
        { provide: ReviewsService, useValue: { create: jest.fn() } },
        { provide: MediaService, useValue: { buildPublicUrl: (key: string) => `https://cdn.test/${key}` } },
        { provide: getQueueToken(QueueName.MEDIA), useValue: mediaQueue },
      ],
    }).compile();

    service = moduleRef.get(PostsService);
  });

  describe('findById', () => {
    it('lança 404 (não 403) quando VisibilityService nega a visualização', async () => {
      visibility.canViewPost.mockResolvedValue(false);

      await expect(service.findById('post-1', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.post.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('só o autor pode remover o post', async () => {
      prisma.post.findFirst.mockResolvedValue({ id: 'post-1', authorId: 'author-1' });

      await expect(service.softDelete('post-1', 'other-user')).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.post.update).not.toHaveBeenCalled();
    });

    it('faz soft delete (nunca exclusão física) quando o autor remove', async () => {
      prisma.post.findFirst.mockResolvedValue({ id: 'post-1', authorId: 'author-1' });

      await service.softDelete('post-1', 'author-1');

      expect(prisma.post.update).toHaveBeenCalledWith({
        where: { id: 'post-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  describe('like', () => {
    it('notifica o autor apenas quando quem curte não é o próprio autor', async () => {
      prisma.post.findFirst.mockResolvedValue({ id: 'post-1', authorId: 'author-1' });

      await service.like('post-1', 'other-user');

      expect(counters.recomputePostLikeCount).toHaveBeenCalledWith('post-1');
      expect(notifications.create).toHaveBeenCalledWith({
        userId: 'author-1',
        type: 'LIKE',
        actorId: 'other-user',
        entityType: 'post',
        entityId: 'post-1',
      });
    });

    it('não notifica quando o autor curte o próprio post', async () => {
      prisma.post.findFirst.mockResolvedValue({ id: 'post-1', authorId: 'author-1' });

      await service.like('post-1', 'author-1');

      expect(notifications.create).not.toHaveBeenCalled();
    });
  });

  describe('unlike', () => {
    it('nunca cria notificação ao descurtir', async () => {
      await service.unlike('post-1', 'user-1');

      expect(prisma.like.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1', postId: 'post-1' } });
      expect(counters.recomputePostLikeCount).toHaveBeenCalledWith('post-1');
      expect(notifications.create).not.toHaveBeenCalled();
    });
  });
});
