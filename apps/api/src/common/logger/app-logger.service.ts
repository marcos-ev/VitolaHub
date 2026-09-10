import { Injectable, LoggerService } from '@nestjs/common';
import pino, { Logger } from 'pino';

// Logger estruturado (seção 9): nunca logamos dado pessoal (e-mail, nome,
// corpo de post/review), apenas identificadores e metadados técnicos.
@Injectable()
export class AppLogger implements LoggerService {
  private readonly pino: Logger;
  private context?: string;

  constructor() {
    this.pino = pino({
      level: process.env.LOG_LEVEL ?? 'info',
      redact: ['req.headers.authorization', 'password', 'passwordHash', 'token'],
    });
  }

  setContext(context: string) {
    this.context = context;
  }

  log(message: unknown, context?: string) {
    this.pino.info({ context: context ?? this.context }, this.stringify(message));
  }

  error(message: unknown, trace?: string, context?: string) {
    this.pino.error({ context: context ?? this.context, trace }, this.stringify(message));
  }

  warn(message: unknown, context?: string) {
    this.pino.warn({ context: context ?? this.context }, this.stringify(message));
  }

  debug(message: unknown, context?: string) {
    this.pino.debug({ context: context ?? this.context }, this.stringify(message));
  }

  verbose(message: unknown, context?: string) {
    this.pino.trace({ context: context ?? this.context }, this.stringify(message));
  }

  private stringify(message: unknown): string {
    return typeof message === 'string' ? message : JSON.stringify(message);
  }
}
