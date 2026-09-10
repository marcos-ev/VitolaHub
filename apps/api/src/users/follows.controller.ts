import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../auth/decorators/current-user.decorator';
import { FollowsService } from './follows.service';
import { UsersService } from './users.service';
import { ReportUserDto } from './dto/report-user.dto';

@Controller({ path: 'users', version: '1' })
export class FollowsController {
  constructor(
    private readonly followsService: FollowsService,
    private readonly usersService: UsersService,
  ) {}

  @Post(':id/follow')
  follow(@CurrentUser() user: RequestUser, @Param('id') targetId: string) {
    return this.followsService.follow(user.id, targetId);
  }

  @Delete(':id/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unfollow(@CurrentUser() user: RequestUser, @Param('id') targetId: string) {
    await this.followsService.unfollow(user.id, targetId);
  }

  @Post(':id/accept')
  async accept(@CurrentUser() user: RequestUser, @Param('id') followerId: string) {
    await this.followsService.acceptRequest(user.id, followerId);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reject(@CurrentUser() user: RequestUser, @Param('id') followerId: string) {
    await this.followsService.rejectRequest(user.id, followerId);
  }

  @Post(':id/report')
  @HttpCode(HttpStatus.NO_CONTENT)
  async report(
    @CurrentUser() user: RequestUser,
    @Param('id') targetId: string,
    @Body() dto: ReportUserDto,
  ) {
    await this.usersService.report(targetId, user.id, dto.reason);
  }

  @Post(':id/block')
  @HttpCode(HttpStatus.NO_CONTENT)
  async block(@CurrentUser() user: RequestUser, @Param('id') targetId: string) {
    await this.followsService.block(user.id, targetId);
  }

  @Post(':id/unblock')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unblock(@CurrentUser() user: RequestUser, @Param('id') targetId: string) {
    await this.followsService.unblock(user.id, targetId);
  }

  @Get(':id/followers')
  followers(@Param('id') userId: string) {
    return this.followsService.listFollowers(userId);
  }

  @Get(':id/following')
  following(@Param('id') userId: string) {
    return this.followsService.listFollowing(userId);
  }

  @Get('me/follow-requests')
  pendingRequests(@CurrentUser() user: RequestUser) {
    return this.followsService.listPendingRequests(user.id);
  }

  @Get('me/blocked')
  blocked(@CurrentUser() user: RequestUser) {
    return this.followsService.listBlocked(user.id);
  }
}
