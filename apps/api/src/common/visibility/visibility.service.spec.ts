import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { VisibilityService } from './visibility.service';

describe('VisibilityService', () => {
  let service: VisibilityService;
  let prisma: {
    post: { findFirst: jest.Mock };
    follow: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      post: { findFirst: jest.fn() },
      follow: { findUnique: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [VisibilityService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(VisibilityService);
  });

  describe('buildPostWhereVisibleTo', () => {
    it('visitante anônimo só vê público de perfil aberto', () => {
      const where = service.buildPostWhereVisibleTo(null);
      expect(where).toEqual({
        deletedAt: null,
        visibility: 'PUBLIC',
        author: { isPrivate: false },
      });
    });

    it('usuário autenticado recebe as quatro condições OR da spec', () => {
      const where = service.buildPostWhereVisibleTo('user-1');
      expect(where.deletedAt).toBeNull();
      expect(where.OR).toHaveLength(4);
      expect(where.OR).toContainEqual({ authorId: 'user-1' });
      expect(where.OR).toContainEqual({
        visibility: 'PUBLIC',
        author: { isPrivate: false },
      });
      expect(where.OR).toContainEqual({
        visibility: 'PUBLIC',
        author: {
          followerEdges: { some: { followerId: 'user-1', status: 'ACCEPTED' } },
        },
      });
      expect(where.OR).toContainEqual({
        visibility: 'FRIENDS',
        author: {
          followerEdges: { some: { followerId: 'user-1', status: 'ACCEPTED' } },
          followingEdges: { some: { followeeId: 'user-1', status: 'ACCEPTED' } },
        },
      });
    });
  });

  describe('canViewPost', () => {
    it('reutiliza a cláusula de listagem para decidir visibilidade de um item', async () => {
      prisma.post.findFirst.mockResolvedValue({ id: 'post-1' });
      const result = await service.canViewPost('post-1', 'user-1');
      expect(result).toBe(true);
      expect(prisma.post.findFirst).toHaveBeenCalledWith({
        where: { id: 'post-1', ...service.buildPostWhereVisibleTo('user-1') },
        select: { id: true },
      });
    });

    it('retorna falso quando o post não casa com nenhuma condição de visibilidade', async () => {
      prisma.post.findFirst.mockResolvedValue(null);
      const result = await service.canViewPost('post-2', 'user-1');
      expect(result).toBe(false);
    });
  });

  describe('areFriends (saoAmigos)', () => {
    it('falso quando A não segue B', async () => {
      prisma.follow.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ status: 'ACCEPTED' });
      const result = await service.areFriends('a', 'b');
      expect(result).toBe(false);
    });

    it('falso quando só existe reciprocidade em um sentido (seguidor simples)', async () => {
      prisma.follow.findUnique
        .mockResolvedValueOnce({ status: 'ACCEPTED' })
        .mockResolvedValueOnce(null);
      const result = await service.areFriends('a', 'b');
      expect(result).toBe(false);
    });

    it('verdadeiro somente quando ambos os sentidos estão ACCEPTED', async () => {
      prisma.follow.findUnique
        .mockResolvedValueOnce({ status: 'ACCEPTED' })
        .mockResolvedValueOnce({ status: 'ACCEPTED' });
      const result = await service.areFriends('a', 'b');
      expect(result).toBe(true);
    });

    it('um usuário nunca é amigo de si mesmo', async () => {
      const result = await service.areFriends('a', 'a');
      expect(result).toBe(false);
      expect(prisma.follow.findUnique).not.toHaveBeenCalled();
    });

    it('pendente em um sentido não conta como amizade', async () => {
      prisma.follow.findUnique
        .mockResolvedValueOnce({ status: 'PENDING' })
        .mockResolvedValueOnce({ status: 'ACCEPTED' });
      const result = await service.areFriends('a', 'b');
      expect(result).toBe(false);
    });
  });
});
