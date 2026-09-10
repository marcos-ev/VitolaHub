import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QueueName } from '../queue/queue.constants';

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Endereço para Reply-To (ex.: e-mail do lead no formulário de contato). */
  replyTo?: string;
}

// Contrato único de envio de e-mail: qualquer módulo (trial, leads de loja,
// relatório mensal) monta o conteúdo e chama `enqueue`. A entrega em si
// (SMTP) fica isolada no EmailsProcessor.
@Injectable()
export class EmailQueueService {
  constructor(@InjectQueue(QueueName.EMAILS) private readonly queue: Queue) {}

  async enqueue(data: EmailJobData): Promise<void> {
    await this.queue.add('SEND_EMAIL', data, { attempts: 3 });
  }
}
