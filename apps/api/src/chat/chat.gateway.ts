import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import * as jwt from 'jsonwebtoken';
import { Server, Socket } from 'socket.io';
import { AccessTokenPayload } from '../auth/token.service';
import { ChatEventsService } from './chat-events.service';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';

interface JoinPayload {
  conversationId?: string;
}

interface SendPayload {
  conversationId?: string;
  body?: string;
}

interface ReadPayload {
  conversationId?: string;
}

interface AckResponse {
  ok: boolean;
  error?: string;
  message?: unknown;
}

/**
 * Tempo real do chat (seção 5.6), com o mesmo `ChatService` usado pelos
 * endpoints REST de fallback — nenhuma regra de negócio vive aqui, só
 * autenticação do handshake e roteamento de eventos de socket.
 *
 * Autenticação: o token de acesso (o mesmo JWT curto usado no REST) vem via
 * header `Authorization: Bearer <token>` ou via query param `?token=`.
 * Decodificado com o mesmo segredo (`JWT_ACCESS_SECRET`) e a mesma lib
 * (`jsonwebtoken`) usados em `JwtAccessStrategy`, sem segredo novo.
 */
@WebSocketGateway({ path: '/chat', cors: { origin: true, credentials: true } })
export class ChatGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer() private server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly config: ConfigService,
    private readonly chatEvents: ChatEventsService,
    private readonly chatService: ChatService,
  ) {}

  afterInit(server: Server): void {
    this.chatEvents.setServer(server);
  }

  handleConnection(client: Socket): void {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = jwt.verify(token, this.config.get<string>('JWT_ACCESS_SECRET')!) as AccessTokenPayload;
      client.data.userId = payload.sub;
      client.data.username = payload.username;
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('conversation:join')
  async handleJoin(@ConnectedSocket() client: Socket, @MessageBody() data: JoinPayload): Promise<AckResponse> {
    const userId = client.data.userId as string | undefined;
    if (!userId) return { ok: false, error: 'Não autenticado' };
    if (!data?.conversationId) return { ok: false, error: 'conversationId é obrigatório' };

    try {
      await this.chatService.assertParticipant(userId, data.conversationId);
      await client.join(`conversation:${data.conversationId}`);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: this.errorMessage(err) };
    }
  }

  @SubscribeMessage('conversation:leave')
  handleLeave(@ConnectedSocket() client: Socket, @MessageBody() data: JoinPayload): AckResponse {
    if (data?.conversationId) void client.leave(`conversation:${data.conversationId}`);
    return { ok: true };
  }

  @SubscribeMessage('message:send')
  async handleSend(@ConnectedSocket() client: Socket, @MessageBody() data: SendPayload): Promise<AckResponse> {
    const userId = client.data.userId as string | undefined;
    if (!userId) return { ok: false, error: 'Não autenticado' };
    if (!data?.conversationId || !data?.body) {
      return { ok: false, error: 'conversationId e body são obrigatórios' };
    }

    try {
      const dto: SendMessageDto = { body: data.body };
      const message = await this.chatService.sendMessage(userId, data.conversationId, dto);
      return { ok: true, message };
    } catch (err) {
      return { ok: false, error: this.errorMessage(err) };
    }
  }

  @SubscribeMessage('message:read')
  async handleRead(@ConnectedSocket() client: Socket, @MessageBody() data: ReadPayload): Promise<AckResponse> {
    const userId = client.data.userId as string | undefined;
    if (!userId) return { ok: false, error: 'Não autenticado' };
    if (!data?.conversationId) return { ok: false, error: 'conversationId é obrigatório' };

    try {
      await this.chatService.markRead(userId, data.conversationId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: this.errorMessage(err) };
    }
  }

  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length);
    }
    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string') return queryToken;
    return null;
  }

  private errorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return 'Erro inesperado';
  }
}
