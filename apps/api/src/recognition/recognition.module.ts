import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { RecognitionController } from './recognition.controller';
import { RecognitionService } from './recognition.service';
import { RecognitionModelClient } from './recognition-model.client';
import { RecognitionCatalogMatcherService } from './recognition-catalog-matcher.service';
import { RecognitionQueueEvents } from './recognition-queue-events';
import { RecognitionProcessor } from './processors/recognition.processor';

// A fila `recognition` (BullMQ) já é registrada globalmente em
// `queue/queue.module.ts` (`BullModule.registerQueue`) — aqui só registramos
// o worker (`RecognitionProcessor`) e os serviços de domínio do módulo,
// seguindo o mesmo padrão de `PostsModule`/`MediaProcessingProcessor`.
@Module({
  imports: [EntitlementsModule],
  controllers: [RecognitionController],
  providers: [
    RecognitionService,
    RecognitionModelClient,
    RecognitionCatalogMatcherService,
    RecognitionQueueEvents,
    RecognitionProcessor,
  ],
  exports: [RecognitionService],
})
export class RecognitionModule {}
