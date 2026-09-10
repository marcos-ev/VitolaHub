import { Controller, Get } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../auth/decorators/current-user.decorator';
import { EntitlementsService } from './entitlements.service';

@Controller({ path: 'entitlements', version: '1' })
export class EntitlementsController {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  @Get('me')
  getMine(@CurrentUser() user: RequestUser) {
    return this.entitlementsService.resolveForUser(user.id);
  }

  @Get('trial-recap')
  getTrialRecap(@CurrentUser() user: RequestUser) {
    return this.entitlementsService.getTrialRecap(user.id);
  }
}
