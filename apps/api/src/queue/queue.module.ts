import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueName } from './queue.constants';
import { DomainEventsService } from './domain-events.service';
import { CountersService } from './counters.service';
import { CountersProcessor } from './processors/counters.processor';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL'),
          maxRetriesPerRequest: null,
        },
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QueueName.COUNTERS },
      { name: QueueName.ACHIEVEMENTS },
      { name: QueueName.MEDIA },
      { name: QueueName.NOTIFICATIONS },
      { name: QueueName.RECOGNITION },
      { name: QueueName.EMAILS },
      // Fase 3a: fila do lembrete de 2h sem resposta da loja (chat). O
      // processor (`ChatReminderProcessor`) vive em `apps/api/src/chat`,
      // não aqui — este módulo só registra a fila em si.
      { name: QueueName.CHAT },
    ),
  ],
  providers: [DomainEventsService, CountersService, CountersProcessor],
  exports: [BullModule, DomainEventsService, CountersService],
})
export class QueueModule {}
