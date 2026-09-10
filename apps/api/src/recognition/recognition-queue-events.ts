import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueEvents } from 'bullmq';
import { QueueName } from '../queue/queue.constants';

/**
 * Conexão dedicada de `QueueEvents` para o padrão request-reply do scan
 * síncrono (`job.waitUntilFinished` — seção 5.7). O BullMQ exige uma conexão
 * Redis própria para eventos, separada da fila/worker; fechada no shutdown
 * do módulo Nest para não vazar conexões.
 */
@Injectable()
export class RecognitionQueueEvents extends QueueEvents implements OnModuleDestroy {
  constructor(config: ConfigService) {
    super(QueueName.RECOGNITION, {
      connection: {
        url: config.get<string>('REDIS_URL'),
        maxRetriesPerRequest: null,
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }
}
