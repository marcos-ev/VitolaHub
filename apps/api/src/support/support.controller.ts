import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, RequestUser } from '../auth/decorators/current-user.decorator';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { CreateSupportMessageDto } from './dto/create-support-message.dto';
import { SupportFeedbackDto } from './dto/support-feedback.dto';
import { SupportService } from './support.service';

@Controller({ path: 'support', version: '1' })
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('tickets')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateSupportTicketDto) {
    return this.supportService.create(user.id, dto);
  }

  @Get('tickets')
  listMine(@CurrentUser() user: RequestUser) {
    return this.supportService.listMine(user.id);
  }

  @Get('tickets/:id')
  getMine(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.supportService.getMine(user.id, id);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('tickets/:id/messages')
  addMessage(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CreateSupportMessageDto,
  ) {
    return this.supportService.addUserMessage(user.id, id, dto);
  }

  @Patch('tickets/:id/feedback')
  feedback(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: SupportFeedbackDto,
  ) {
    return this.supportService.setFeedback(user.id, id, dto.helpful);
  }
}
