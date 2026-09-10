import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { CounterJob, QueueName } from '../queue.constants';

/**
 * Worker único da fila `counters` (seção 4 e 8): todo contador desnormalizado
 * (rating_avg/rating_count, like_count, comment_count, follower/following/
 * friend_count) é recalculado aqui, nunca com agregação em tempo de leitura.
 * Consolidado num único processor para a fila inteira, evitando que dois
 * workers concorram pelos mesmos jobs.
 */
@Processor(QueueName.COUNTERS)
export class CountersProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case CounterJob.RECOMPUTE_CIGAR_RATING:
        return this.recomputeCigarRating(job.data.cigarId);
      case CounterJob.RECOMPUTE_POST_LIKE_COUNT:
        return this.recomputePostLikeCount(job.data.postId);
      case CounterJob.RECOMPUTE_POST_COMMENT_COUNT:
        return this.recomputePostCommentCount(job.data.postId);
      case CounterJob.RECOMPUTE_FRIEND_COUNT:
        return this.recomputeFriendCount(job.data.userId);
      case CounterJob.RECOMPUTE_FOLLOW_COUNTS:
        return this.recomputeFollowCounts(job.data.userId);
      default:
        return;
    }
  }

  private async recomputeCigarRating(cigarId: string) {
    const agg = await this.prisma.review.aggregate({
      where: { cigarId, deletedAt: null },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await this.prisma.cigar.update({
      where: { id: cigarId },
      data: {
        ratingAvg: agg._avg.rating ?? 0,
        ratingCount: agg._count._all,
      },
    });
  }

  private async recomputePostLikeCount(postId: string) {
    const count = await this.prisma.like.count({ where: { postId } });
    await this.prisma.post.update({ where: { id: postId }, data: { likeCount: count } });
  }

  private async recomputePostCommentCount(postId: string) {
    const count = await this.prisma.comment.count({ where: { postId, deletedAt: null } });
    await this.prisma.post.update({ where: { id: postId }, data: { commentCount: count } });
  }

  private async recomputeFollowCounts(userId: string) {
    const [followerCount, followingCount] = await Promise.all([
      this.prisma.follow.count({ where: { followeeId: userId, status: 'ACCEPTED' } }),
      this.prisma.follow.count({ where: { followerId: userId, status: 'ACCEPTED' } }),
    ]);
    await this.prisma.user.update({ where: { id: userId }, data: { followerCount, followingCount } });
  }

  private async recomputeFriendCount(userId: string) {
    const result = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*)::bigint AS count
      FROM follows f1
      JOIN follows f2
        ON f2.follower_id = f1.followee_id
       AND f2.followee_id = f1.follower_id
      WHERE f1.follower_id = ${userId}::uuid
        AND f1.status = 'ACCEPTED'
        AND f2.status = 'ACCEPTED'
    `;
    const friendCount = Number(result[0]?.count ?? 0);
    await this.prisma.user.update({ where: { id: userId }, data: { friendCount } });
  }
}
