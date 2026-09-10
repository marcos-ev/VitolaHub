import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SupportMessageAuthor, SupportTicketCategory, SupportTicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { CreateSupportMessageDto } from './dto/create-support-message.dto';

export interface SupportMessageView {
  id: string;
  authorType: SupportMessageAuthor;
  authorLabel: string;
  body: string;
  createdAt: string;
}

export interface SupportTicketSummary {
  id: string;
  code: string;
  category: SupportTicketCategory;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  attachmentUrls: string[];
  helpful: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicketDetail extends SupportTicketSummary {
  clientMeta: Record<string, unknown> | null;
  messages: SupportMessageView[];
}

const ACK_BODY =
  'Recebemos seu chamado. Nossa equipe responde em até 1 dia útil (Premium: até 4 horas).';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateSupportTicketDto): Promise<SupportTicketDetail> {
    const attachmentUrls = dto.attachmentUrls ?? [];
    if (attachmentUrls.length > 3) {
      throw new BadRequestException('Máximo de 3 anexos');
    }

    const ticket = await this.prisma.$transaction(async (tx) => {
      const created = await tx.supportTicket.create({
        data: {
          userId,
          category: dto.category,
          subject: dto.subject.trim(),
          message: dto.message.trim(),
          attachmentUrls,
          clientMeta: dto.clientMeta
            ? (dto.clientMeta as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      });

      await tx.supportTicketMessage.createMany({
        data: [
          {
            ticketId: created.id,
            authorType: 'USER',
            authorId: userId,
            body: dto.message.trim(),
          },
          {
            ticketId: created.id,
            authorType: 'STAFF',
            authorId: null,
            body: ACK_BODY,
          },
        ],
      });

      return created;
    });

    return this.getMine(userId, ticket.id);
  }

  async listMine(userId: string): Promise<SupportTicketSummary[]> {
    const tickets = await this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return tickets.map((t) => this.toSummary(t));
  }

  async getMine(userId: string, ticketId: string): Promise<SupportTicketDetail> {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!ticket) throw new NotFoundException('Chamado não encontrado');

    return {
      ...this.toSummary(ticket),
      clientMeta: (ticket.clientMeta as Record<string, unknown> | null) ?? null,
      messages: ticket.messages.map((m) => this.toMessage(m)),
    };
  }

  async addUserMessage(userId: string, ticketId: string, dto: CreateSupportMessageDto): Promise<SupportMessageView> {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, userId },
    });
    if (!ticket) throw new NotFoundException('Chamado não encontrado');
    if (ticket.status === 'CLOSED') {
      throw new BadRequestException('Este chamado está fechado');
    }

    const message = await this.prisma.supportTicketMessage.create({
      data: {
        ticketId,
        authorType: 'USER',
        authorId: userId,
        body: dto.body.trim(),
      },
    });

    if (ticket.status === 'RESOLVED') {
      await this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: 'IN_PROGRESS', helpful: null },
      });
    } else {
      await this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: { updatedAt: new Date() },
      });
    }

    return this.toMessage(message);
  }

  async setFeedback(userId: string, ticketId: string, helpful: boolean): Promise<SupportTicketSummary> {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, userId },
    });
    if (!ticket) throw new NotFoundException('Chamado não encontrado');
    if (ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED') {
      throw new BadRequestException('Feedback só é disponível após o chamado ser resolvido');
    }

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { helpful },
    });
    return this.toSummary(updated);
  }

  private toSummary(ticket: {
    id: string;
    number: number;
    category: SupportTicketCategory;
    subject: string;
    message: string;
    status: SupportTicketStatus;
    attachmentUrls: string[];
    helpful: boolean | null;
    createdAt: Date;
    updatedAt: Date;
  }): SupportTicketSummary {
    return {
      id: ticket.id,
      code: `VH-${ticket.number}`,
      category: ticket.category,
      subject: ticket.subject,
      message: ticket.message,
      status: ticket.status,
      attachmentUrls: ticket.attachmentUrls,
      helpful: ticket.helpful,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    };
  }

  private toMessage(message: {
    id: string;
    authorType: SupportMessageAuthor;
    body: string;
    createdAt: Date;
  }): SupportMessageView {
    return {
      id: message.id,
      authorType: message.authorType,
      authorLabel: message.authorType === 'USER' ? 'Você' : 'Equipe Vitola Hub',
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    };
  }
}
