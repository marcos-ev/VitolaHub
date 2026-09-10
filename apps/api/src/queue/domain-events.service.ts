import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { DomainEvent, DomainEventPayload, QueueName } from './queue.constants';

// Ponto único de publicação de eventos de domínio (seção 5.4). Qualquer
// módulo de feature (reviews, follows, humidor, catálogo) chama `publish`
// depois de confirmar a transação — nunca antes, para não gerar selo por
// uma escrita que acabou revertida.
@Injectable()
export class DomainEventsService {
  constructor(@InjectQueue(QueueName.ACHIEVEMENTS) private readonly achievementsQueue: Queue) {}

  async publish<E extends DomainEvent>(event: E, payload: DomainEventPayload[E]): Promise<void> {
    // jobId determinístico por evento de origem quando disponível evitaria
    // duplicidade na fila; como o payload varia, a idempotência real fica a
    // cargo do worker (UNIQUE em user_achievements), conforme exigido pelo
    // critério de aceite de selo único mesmo com evento duplicado.
    await this.achievementsQueue.add(
      event,
      { event, payload, emittedAt: new Date().toISOString() },
      { jobId: randomUUID() },
    );
  }
}
