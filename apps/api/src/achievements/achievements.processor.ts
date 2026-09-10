import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QueueName, DomainEvent, DomainEventPayload } from '../queue/queue.constants';
import { AchievementsService } from './achievements.service';

interface AchievementsJobData<E extends DomainEvent = DomainEvent> {
  event: E;
  payload: DomainEventPayload[E];
  emittedAt: string;
}

/**
 * Único worker da fila `achievements` (seção 5.4). `job.name` é o nome do
 * evento de domínio (ver `DomainEventsService.publish`); delega toda a
 * lógica de avaliação para `AchievementsService`, que é quem garante a
 * idempotência real via constraint de banco.
 */
@Processor(QueueName.ACHIEVEMENTS)
export class AchievementsProcessor extends WorkerHost {
  constructor(private readonly achievementsService: AchievementsService) {
    super();
  }

  async process(job: Job<AchievementsJobData>): Promise<void> {
    await this.achievementsService.evaluateEvent(job.data.event, job.data.payload);
  }
}
