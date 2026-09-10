import { Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../guards/admin.guard';
import { AdminModerationService } from './admin-moderation.service';
import { ListReportsDto } from './dto/list-reports.dto';

@UseGuards(AdminGuard)
@Controller({ path: 'admin', version: '1' })
export class AdminModerationController {
  constructor(private readonly moderationService: AdminModerationService) {}

  @Get('reports')
  listReports(@Query() query: ListReportsDto) {
    return this.moderationService.listReports(query);
  }

  @Post('reports/:id/resolve')
  resolveReport(@Param('id') id: string) {
    return this.moderationService.resolve(id);
  }

  @Post('reports/:id/dismiss')
  dismissReport(@Param('id') id: string) {
    return this.moderationService.dismiss(id);
  }

  @Delete('posts/:id')
  removePost(@Param('id') id: string) {
    return this.moderationService.removePost(id);
  }

  @Post('users/:id/suspend')
  suspendUser(@Param('id') id: string) {
    return this.moderationService.suspendUser(id);
  }

  @Post('users/:id/unsuspend')
  unsuspendUser(@Param('id') id: string) {
    return this.moderationService.unsuspendUser(id);
  }
}
