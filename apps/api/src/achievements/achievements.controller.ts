import { Controller, Get } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../auth/decorators/current-user.decorator';
import { AchievementsService } from './achievements.service';

@Controller({ path: 'achievements', version: '1' })
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Get('me')
  getMine(@CurrentUser() user: RequestUser) {
    return this.achievementsService.getProgressForUser(user.id);
  }
}
