import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController, PushTokenController } from './notifications.controller';
import { PushProcessor } from './push.processor';

// Global porque virtualmente todo módulo de feature precisa notificar
// alguém. Controller de listagem/leitura + worker de push (Fase 1) vivem
// neste mesmo módulo.
@Global()
@Module({
  controllers: [NotificationsController, PushTokenController],
  providers: [NotificationsService, PushProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
