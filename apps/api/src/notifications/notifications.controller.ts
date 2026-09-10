import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { SetPushTokenDto } from './dto/set-push-token.dto';

@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query('cursor') cursor?: string) {
    return this.notificationsService.listForUser(user.id, cursor);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async readAll(@CurrentUser() user: RequestUser) {
    await this.notificationsService.markAllRead(user.id);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async read(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.notificationsService.markRead(user.id, id);
  }
}

// Endpoint fica sob /users/me/push-token (não /notifications) por convenção
// de recurso (é um dado do usuário), mas reaproveita o mesmo service.
@Controller({ path: 'users', version: '1' })
export class PushTokenController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('me/push-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setPushToken(@CurrentUser() user: RequestUser, @Body() dto: SetPushTokenDto) {
    await this.notificationsService.setPushToken(user.id, dto.expoPushToken ?? null);
  }
}
