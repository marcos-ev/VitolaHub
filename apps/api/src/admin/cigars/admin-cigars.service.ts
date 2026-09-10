import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { DomainEventsService } from '../../queue/domain-events.service';
import { DomainEvent } from '../../queue/queue.constants';
import { CursorPage, DEFAULT_PAGE_SIZE, decodeCursor, paginateResults } from '../../common/pagination/cursor.util';
import { RejectCigarDto } from './dto/reject-cigar.dto';
import { UpdateCigarDto } from './dto/update-cigar.dto';

/**
 * Aprovação de sugestões de charuto ao catálogo (seção 5.3). A aprovação
 * publica `DomainEvent.CIGAR_SUGGESTION_APPROVED` (motor de conquistas já
 * existente cuida do selo "Primeira Sugestão Aprovada" — não implementado
 * aqui) e cria uma notificação in-app para quem sugeriu.
 *
 * Sobre o tipo de notificação: o enum `NotificationType` do schema não tem um
 * valor específico para "sua sugestão de charuto foi aprovada". Reaproveitei
 * `INVITE_ACCEPTED` como o mais próximo semanticamente (algo que o próprio
 * usuário iniciou e foi aceito/aprovado por outra parte) — documentado
 * também no resumo final para uma eventual adição de um tipo dedicado
 * (`CIGAR_SUGGESTION_APPROVED`) ao schema.
 */
@Injectable()
export class AdminCigarsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly domainEvents: DomainEventsService,
  ) {}

  async listPending(cursorRaw?: string): Promise<CursorPage<unknown>> {
    const cursor = decodeCursor(cursorRaw);

    const cigars = await this.prisma.cigar.findMany({
      where: {
        status: 'PENDING',
        deletedAt: null,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: DEFAULT_PAGE_SIZE + 1,
      include: {
        brand: { select: { id: true, name: true, countryCode: true } },
        suggestedByUser: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });

    return paginateResults(cigars, DEFAULT_PAGE_SIZE);
  }

  private async findCigarOrThrow(id: string) {
    const cigar = await this.prisma.cigar.findFirst({ where: { id, deletedAt: null } });
    if (!cigar) throw new NotFoundException('Charuto não encontrado');
    return cigar;
  }

  async approve(id: string) {
    const cigar = await this.findCigarOrThrow(id);

    const updated = await this.prisma.cigar.update({
      where: { id },
      data: { status: 'APPROVED' },
    });

    if (cigar.suggestedBy) {
      await this.domainEvents.publish(DomainEvent.CIGAR_SUGGESTION_APPROVED, {
        userId: cigar.suggestedBy,
        cigarId: cigar.id,
      });

      await this.notifications.create({
        userId: cigar.suggestedBy,
        type: NotificationType.INVITE_ACCEPTED,
        entityType: 'CIGAR',
        entityId: cigar.id,
      });
    }

    return updated;
  }

  async reject(id: string, _dto: RejectCigarDto) {
    await this.findCigarOrThrow(id);

    return this.prisma.cigar.update({
      where: { id },
      data: { status: 'REJECTED' },
    });
  }

  async update(id: string, dto: UpdateCigarDto) {
    await this.findCigarOrThrow(id);

    return this.prisma.cigar.update({
      where: { id },
      data: {
        ...(dto.brandId !== undefined ? { brandId: dto.brandId } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.line !== undefined ? { line: dto.line } : {}),
        ...(dto.countryCode !== undefined ? { countryCode: dto.countryCode } : {}),
        ...(dto.vitola !== undefined ? { vitola: dto.vitola } : {}),
        ...(dto.lengthMm !== undefined ? { lengthMm: dto.lengthMm } : {}),
        ...(dto.ringGauge !== undefined ? { ringGauge: dto.ringGauge } : {}),
        ...(dto.strength !== undefined ? { strength: dto.strength } : {}),
        ...(dto.wrapper !== undefined ? { wrapper: dto.wrapper } : {}),
        ...(dto.avgSmokeMinutes !== undefined ? { avgSmokeMinutes: dto.avgSmokeMinutes } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
      },
    });
  }
}
