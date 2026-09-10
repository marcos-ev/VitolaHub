import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatEventsService } from './chat-events.service';
import { ChatReminderProcessor } from './processors/chat-reminder.processor';

@Module({
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, ChatEventsService, ChatReminderProcessor],
  exports: [ChatService],
})
export class ChatModule {}
