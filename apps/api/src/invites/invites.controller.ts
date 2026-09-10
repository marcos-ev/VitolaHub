import { Controller, Get } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../auth/decorators/current-user.decorator';
import { InvitesService } from './invites.service';

@Controller({ path: 'invites', version: '1' })
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Get('me')
  getMine(@CurrentUser() user: RequestUser) {
    return this.invitesService.getMyInvite(user.id);
  }
}
