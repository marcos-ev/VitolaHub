import { Module } from '@nestjs/common';
import { AchievementsController } from './achievements.controller';
import { AchievementsService } from './achievements.service';
import { AchievementsProcessor } from './achievements.processor';

@Module({
  controllers: [AchievementsController],
  providers: [AchievementsService, AchievementsProcessor],
  exports: [AchievementsService],
})
export class AchievementsModule {}
