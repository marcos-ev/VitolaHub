import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { VisibilityService } from '../common/visibility/visibility.service';
import { CursorPage, DEFAULT_PAGE_SIZE, decodeCursor, paginateResults } from '../common/pagination/cursor.util';
import { MediaService } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CountersService } from '../queue/counters.service';
import { QueueName } from '../queue/queue.constants';
import { ReviewsService } from '../reviews/reviews.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { MediaJob } from './media-processing.processor';
import { buildPostInclude, mapPostToSummary, PostWithRelations } from './post-mapper';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: VisibilityService,
    private readonly counters: CountersService,
    private readonly notifications: NotificationsService,
    private readonly reviewsService: ReviewsService,
    private readonly mediaService: MediaService,
    @InjectQueue(QueueName.MEDIA) private readonly mediaQueue: Queue,
  ) {}

  /**
   * Cria o post e os `PostMedia` imediatamente com a URL original (para não
   * bloquear o usuário — seção 2/8) e enfileira o processamento assíncrono
   * (thumb/feed/original em WebP) na fila `media`. Opcionalmente cria a
   * avaliação estruturada vinculada ("avaliar com post").
   */
  async create(userId: string, dto: CreatePostDto) {
    if (dto.review && !dto.cigarId) {
      throw new BadRequestException('Para avaliar junto com o post, informe o cigarId');
    }

    if (dto.cigarId) {
      const cigar = await this.prisma.cigar.findFirst({ where: { id: dto.cigarId, deletedAt: null } });
      if (!cigar) throw new NotFoundException('Charuto não encontrado');
    }

    const post = await this.prisma.post.create({
      data: {
        authorId: userId,
        cigarId: dto.cigarId,
        body: dto.body,
        visibility: dto.visibility ?? 'PUBLIC',
        media: {
          create: dto.media.map((item, index) => ({
            url: this.mediaService.buildPublicUrl(item.objectKey),
            thumbUrl: this.mediaService.buildPublicUrl(item.objectKey),
            width: item.width,
            height: item.height,
            position: index,
          })),
        },
      },
      include: { media: true },
    });

    await Promise.all(
      post.media.map((media, index) =>
        this.mediaQueue.add(
          'PROCESS_POST_MEDIA',
          { postMediaId: media.id, objectKey: dto.media[index].objectKey } satisfies MediaJob,
          { attempts: 3 },
        ),
      ),
    );

    if (dto.review) {
      await this.reviewsService.create(userId, {
        ...dto.review,
        cigarId: dto.cigarId!,
        postId: post.id,
      });
    }

    return this.findById(post.id, userId);
  }

  async findById(postId: string, currentUserId: string | null) {
    const canView = await this.visibility.canViewPost(postId, currentUserId);
    if (!canView) throw new NotFoundException('Post não encontrado');

    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
      include: buildPostInclude(currentUserId),
    });
    if (!post) throw new NotFoundException('Post não encontrado');

    return mapPostToSummary(post as PostWithRelations, currentUserId);
  }

  async softDelete(postId: string, userId: string) {
    const post = await this.prisma.post.findFirst({ where: { id: postId, deletedAt: null } });
    if (!post) throw new NotFoundException('Post não encontrado');
    if (post.authorId !== userId) throw new ForbiddenException('Só o autor pode remover o post');

    await this.prisma.post.update({ where: { id: postId }, data: { deletedAt: new Date() } });
  }

  async like(postId: string, userId: string) {
    const post = await this.prisma.post.findFirst({ where: { id: postId, deletedAt: null } });
    if (!post) throw new NotFoundException('Post não encontrado');

    const canView = await this.visibility.canViewPost(postId, userId);
    if (!canView) throw new NotFoundException('Post não encontrado');

    await this.prisma.like.upsert({
      where: { userId_postId: { userId, postId } },
      create: { userId, postId },
      update: {},
    });

    await this.counters.recomputePostLikeCount(postId);

    if (post.authorId !== userId) {
      await this.notifications.create({
        userId: post.authorId,
        type: 'LIKE',
        actorId: userId,
        entityType: 'post',
        entityId: postId,
      });
    }
  }

  async unlike(postId: string, userId: string) {
    await this.prisma.like.deleteMany({ where: { userId, postId } });
    await this.counters.recomputePostLikeCount(postId);
  }

  async comment(postId: string, userId: string, dto: CreateCommentDto) {
    const post = await this.prisma.post.findFirst({ where: { id: postId, deletedAt: null } });
    if (!post) throw new NotFoundException('Post não encontrado');

    const canView = await this.visibility.canViewPost(postId, userId);
    if (!canView) throw new NotFoundException('Post não encontrado');

    if (dto.parentId) {
      const parent = await this.prisma.comment.findFirst({
        where: { id: dto.parentId, postId, deletedAt: null },
      });
      if (!parent) throw new NotFoundException('Comentário original não encontrado');
    }

    const comment = await this.prisma.comment.create({
      data: { postId, authorId: userId, body: dto.body, parentId: dto.parentId },
      include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });

    await this.counters.recomputePostCommentCount(postId);

    if (post.authorId !== userId) {
      await this.notifications.create({
        userId: post.authorId,
        type: 'COMMENT',
        actorId: userId,
        entityType: 'post',
        entityId: postId,
      });
    }

    return comment;
  }

  async listComments(postId: string, currentUserId: string | null, cursorRaw?: string): Promise<CursorPage<unknown>> {
    const canView = await this.visibility.canViewPost(postId, currentUserId);
    if (!canView) throw new NotFoundException('Post não encontrado');

    const cursor = decodeCursor(cursorRaw);
    const comments = await this.prisma.comment.findMany({
      where: {
        postId,
        deletedAt: null,
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
      include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });

    return paginateResults(comments, DEFAULT_PAGE_SIZE);
  }

  async deleteComment(postId: string, commentId: string, userId: string) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, postId, deletedAt: null },
    });
    if (!comment) throw new NotFoundException('Comentário não encontrado');
    if (comment.authorId !== userId) throw new ForbiddenException('Só o autor pode excluir o comentário');

    await this.prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
    await this.counters.recomputePostCommentCount(postId);
  }

  /** Grade de posts do perfil (própria ou de terceiros), respeitando a mesma camada única de visibilidade do feed. */
  async listByAuthor(
    authorId: string,
    currentUserId: string | null,
    cursorRaw?: string,
  ): Promise<CursorPage<unknown>> {
    const cursor = decodeCursor(cursorRaw);
    const cursorWhere: Prisma.PostWhereInput | undefined = cursor
      ? {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
          ],
        }
      : undefined;

    const posts = await this.prisma.post.findMany({
      where: {
        authorId,
        AND: [this.visibility.buildPostWhereVisibleTo(currentUserId), ...(cursorWhere ? [cursorWhere] : [])],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: DEFAULT_PAGE_SIZE + 1,
      include: buildPostInclude(currentUserId),
    });

    const page = paginateResults(posts, DEFAULT_PAGE_SIZE);
    return {
      ...page,
      items: page.items.map((post) => mapPostToSummary(post as PostWithRelations, currentUserId)),
    };
  }

  /**
   * Grade de descoberta da tela Explorar: publicações públicas recentes de
   * toda a base (não só de quem o usuário segue), reaproveitando a mesma
   * camada única de visibilidade do feed/perfil — nunca reimplementar a regra
   * aqui (ver `VisibilityService`).
   */
  async listPublic(currentUserId: string | null, cursorRaw?: string): Promise<CursorPage<unknown>> {
    const cursor = decodeCursor(cursorRaw);
    const cursorWhere: Prisma.PostWhereInput | undefined = cursor
      ? {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
          ],
        }
      : undefined;

    const posts = await this.prisma.post.findMany({
      where: {
        visibility: 'PUBLIC',
        AND: [this.visibility.buildPostWhereVisibleTo(currentUserId), ...(cursorWhere ? [cursorWhere] : [])],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: DEFAULT_PAGE_SIZE + 1,
      include: buildPostInclude(currentUserId),
    });

    const page = paginateResults(posts, DEFAULT_PAGE_SIZE);
    return {
      ...page,
      items: page.items.map((post) => mapPostToSummary(post as PostWithRelations, currentUserId)),
    };
  }

  async report(postId: string, reporterId: string, reason: string) {
    const post = await this.prisma.post.findFirst({ where: { id: postId, deletedAt: null } });
    if (!post) throw new NotFoundException('Post não encontrado');
    if (post.authorId === reporterId) {
      throw new ForbiddenException('Você não pode denunciar a própria publicação');
    }

    const canView = await this.visibility.canViewPost(postId, reporterId);
    if (!canView) throw new NotFoundException('Post não encontrado');

    return this.prisma.report.create({
      data: { reporterId, entityType: 'POST', entityId: postId, reason },
    });
  }
}
