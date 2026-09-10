import { Module } from '@nestjs/common';
import { EntitlementsController } from './entitlements.controller';
import { EntitlementsService } from './entitlements.service';
import { EntitlementsGuard } from './entitlements.guard';
import { TrialRemindersCron } from './trial-reminders.cron';

@Module({
  controllers: [EntitlementsController],
  providers: [EntitlementsService, EntitlementsGuard, TrialRemindersCron],
  exports: [EntitlementsService, EntitlementsGuard],
})
export class EntitlementsModule {}
