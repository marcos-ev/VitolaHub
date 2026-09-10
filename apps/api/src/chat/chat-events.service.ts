import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

/**
 * Ponte fina entre `ChatService` (REST + lógica de negócio) e `ChatGateway`
 * (WebSocket), sem que um dependa do outro diretamente — evita dependência
 * circular. `ChatGateway` injeta o `Server` do Socket.IO aqui assim que
 * inicializa; `ChatService` chama estes métodos depois de persistir uma
 * mensagem/leitura, tanto quando a requisição veio por REST quanto por
 * WebSocket, garantindo uma única fonte de emissão de eventos.
 */
@Injectable()
export class ChatEventsService {
  private server: Server | null = null;

  setServer(server: Server): void {
    this.server = server;
  }

  emitMessageNew(conversationId: string, message: unknown): void {
    this.server?.to(`conversation:${conversationId}`).emit('message:new', message);
  }

  emitMessageRead(conversationId: string, payload: unknown): void {
    this.server?.to(`conversation:${conversationId}`).emit('message:read', payload);
  }
}
