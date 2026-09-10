import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { CounterJob, QueueName } from './queue.constants';

// Ponto único para enfileirar recomputação de contadores desnormalizados.
// Deduplica por jobId determinístico: se dois eventos pedirem o recálculo do
// mesmo alvo antes do worker rodar, viram um único job.
@Injectable()
export class CountersService {
  constructor(@InjectQueue(QueueName.COUNTERS) private readonly queue: Queue) {}

  recomputeCigarRating(cigarId: string) {
    return this.enqueue(CounterJob.RECOMPUTE_CIGAR_RATING, { cigarId }, `cigar-rating-${cigarId}`);
  }

  recomputePostLikeCount(postId: string) {
    return this.enqueue(CounterJob.RECOMPUTE_POST_LIKE_COUNT, { postId }, `post-likes-${postId}`);
  }

  recomputePostCommentCount(postId: string) {
    return this.enqueue(
      CounterJob.RECOMPUTE_POST_COMMENT_COUNT,
      { postId },
      `post-comments-${postId}`,
    );
  }

  recomputeFriendCount(userId: string) {
    return this.enqueue(CounterJob.RECOMPUTE_FRIEND_COUNT, { userId }, `friend-count-${userId}`);
  }

  recomputeFollowCounts(userId: string) {
    return this.enqueue(CounterJob.RECOMPUTE_FOLLOW_COUNTS, { userId }, `follow-counts-${userId}`);
  }

  private async enqueue(name: CounterJob, data: Record<string, string>, jobId: string) {
    await this.queue.add(name, data, { jobId, delay: 500 });
  }
}
