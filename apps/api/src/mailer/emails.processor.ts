import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import * as nodemailer from 'nodemailer';
import { QueueName } from '../queue/queue.constants';
import { EmailJobData } from './email-queue.service';

@Processor(QueueName.EMAILS)
export class EmailsProcessor extends WorkerHost {
  private readonly transporter;

  constructor(config: ConfigService) {
    super();
    this.transporter = nodemailer.createTransport({
      host: config.get<string>('SMTP_HOST'),
      port: Number(config.get<string>('SMTP_PORT') ?? '587'),
      auth: config.get('SMTP_USER')
        ? { user: config.get<string>('SMTP_USER'), pass: config.get<string>('SMTP_PASS') }
        : undefined,
    });
    this.fromAddress = config.get<string>('SMTP_FROM') ?? 'Vitola Hub <no-reply@vitolahub.com.br>';
  }

  private readonly fromAddress: string;

  async process(job: Job<EmailJobData>): Promise<void> {
    if (!process.env.SMTP_HOST) {
      // Em desenvolvimento sem SMTP configurado, apenas registra — não falha o job.
      // eslint-disable-next-line no-console
      console.log(
        `[email:dev] para=${job.data.to} assunto="${job.data.subject}"` +
          (job.data.replyTo ? ` replyTo=${job.data.replyTo}` : ''),
      );
      if (job.data.text) {
        // eslint-disable-next-line no-console
        console.log(`[email:dev] corpo:\n${job.data.text}`);
      }
      return;
    }
    await this.transporter.sendMail({
      from: this.fromAddress,
      to: job.data.to,
      replyTo: job.data.replyTo,
      subject: job.data.subject,
      html: job.data.html,
      text: job.data.text,
    });
  }
}
