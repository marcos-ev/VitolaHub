import { Global, Module } from '@nestjs/common';
import { EmailQueueService } from './email-queue.service';
import { EmailsProcessor } from './emails.processor';

@Global()
@Module({
  providers: [EmailQueueService, EmailsProcessor],
  exports: [EmailQueueService],
})
export class MailerModule {}
