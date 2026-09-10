import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailQueueService } from '../mailer/email-queue.service';
import { CreateContactDto, ContactType } from './dto/create-contact.dto';

const SUBJECT_PREFIX: Record<ContactType, string> = {
  contact: '[Vitola Hub Contato]',
  support: '[Vitola Hub Contato]',
  founding: '[Vitola Hub Fundador]',
};

@Injectable()
export class MarketingService {
  private readonly logger = new Logger(MarketingService.name);

  constructor(
    private readonly emailQueue: EmailQueueService,
    private readonly config: ConfigService,
  ) {}

  async submitContact(dto: CreateContactDto) {
    const to =
      this.config.get<string>('CONTACT_TO_EMAIL')?.trim() || 'vitolahub@gmail.com';
    const prefix = SUBJECT_PREFIX[dto.type];
    const subjectTail =
      dto.subject?.trim() ||
      (dto.type === 'founding'
        ? `Candidatura — ${dto.tradeName?.trim() || dto.name}`
        : `Mensagem de ${dto.name}`);
    const subject = `${prefix} ${subjectTail}`;

    const text = this.buildText(dto);
    const html = this.buildHtml(dto);

    if (!process.env.SMTP_HOST) {
      this.logger.log(
        `[contact:dev] SMTP ausente — enfileirando e-mail (será só logado). to=${to} type=${dto.type}`,
      );
    }

    await this.emailQueue.enqueue({
      to,
      subject,
      html,
      text,
      replyTo: dto.email,
    });

    return { ok: true };
  }

  private buildText(dto: CreateContactDto): string {
    const lines = [
      `Tipo: ${dto.type}`,
      `Nome: ${dto.name}`,
      `E-mail: ${dto.email}`,
    ];
    if (dto.subject) lines.push(`Assunto: ${dto.subject}`);
    if (dto.tradeName) lines.push(`Loja: ${dto.tradeName}`);
    if (dto.city) lines.push(`Cidade: ${dto.city}`);
    if (dto.whatsapp) lines.push(`WhatsApp: ${dto.whatsapp}`);
    if (dto.instagram) lines.push(`Instagram: ${dto.instagram}`);
    lines.push('', 'Mensagem:', dto.message);
    return lines.join('\n');
  }

  private buildHtml(dto: CreateContactDto): string {
    const row = (label: string, value?: string) =>
      value
        ? `<tr><td style="padding:6px 12px 6px 0;color:#7a6a54;vertical-align:top">${escapeHtml(label)}</td><td style="padding:6px 0;color:#1c1510">${escapeHtml(value)}</td></tr>`
        : '';

    return `
      <div style="font-family:DM Sans,Segoe UI,sans-serif;max-width:560px;line-height:1.5">
        <p style="margin:0 0 12px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#a67c37">
          Vitola Hub · ${escapeHtml(dto.type)}
        </p>
        <table style="border-collapse:collapse;width:100%;font-size:15px">
          ${row('Nome', dto.name)}
          ${row('E-mail', dto.email)}
          ${row('Assunto', dto.subject)}
          ${row('Loja', dto.tradeName)}
          ${row('Cidade', dto.city)}
          ${row('WhatsApp', dto.whatsapp)}
          ${row('Instagram', dto.instagram)}
        </table>
        <div style="margin-top:18px;padding:14px 16px;background:#f7f1e6;border-radius:12px;white-space:pre-wrap;color:#1c1510">
${escapeHtml(dto.message)}
        </div>
      </div>
    `.trim();
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
