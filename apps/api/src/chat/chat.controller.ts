import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../auth/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { OpenConversationDto } from './dto/open-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ReportConversationDto } from './dto/report-conversation.dto';

// Endpoints REST de fallback para quem não está conectado via WebSocket
// (`ChatGateway`) — mesmo `ChatService` por baixo dos dois transportes.
@Controller({ path: 'chat', version: '1' })
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('conversations')
  open(@CurrentUser() user: RequestUser, @Body() dto: OpenConversationDto) {
    return this.chatService.openConversation(user.id, dto);
  }

  @Get('conversations')
  list(@CurrentUser() user: RequestUser, @Query('cursor') cursor?: string) {
    return this.chatService.listConversations(user.id, cursor);
  }

  @Get('conversations/:id/messages')
  listMessages(@CurrentUser() user: RequestUser, @Param('id') id: string, @Query('cursor') cursor?: string) {
    return this.chatService.listMessages(user.id, id, cursor);
  }

  @Post('conversations/:id/messages')
  sendMessage(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.chatService.sendMessage(user.id, id, dto);
  }

  @Post('conversations/:id/read')
  markRead(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.chatService.markRead(user.id, id);
  }

  @Post('conversations/:id/report')
  @HttpCode(HttpStatus.NO_CONTENT)
  async report(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: ReportConversationDto) {
    await this.chatService.reportConversation(id, user.id, dto.reason);
  }
}
