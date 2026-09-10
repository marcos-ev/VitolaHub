import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FREE_HUMIDOR_LIMIT } from '@charuto/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { DomainEventsService } from '../queue/domain-events.service';
import { DomainEvent } from '../queue/queue.constants';
import { AddHumidorItemDto } from './dto/add-humidor-item.dto';
import { UpdateHumidorItemDto } from './dto/update-humidor-item.dto';

interface OwnedHumidorItem {
  id: string;
  acquiredAt: Date;
}

/**
 * Umidor pessoal (seção 6.2/6.3). Limite gratuito de 25 itens ativos: quem
 * não tem Premium/trial ativo não consegue adicionar o 26º item, mas nunca
 * perde acesso ao que já tinha — itens além do limite ficam visíveis em modo
 * somente leitura, nunca ocultos ou apagados.
 */
@Injectable()
export class HumidorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly domainEvents: DomainEventsService,
  ) {}

  async addItem(userId: string, dto: AddHumidorItemDto) {
    const cigar = await this.prisma.cigar.findFirst({ where: { id: dto.cigarId, deletedAt: null } });
    if (!cigar) throw new NotFoundException('Charuto não encontrado');

    const snapshot = await this.entitlements.resolveForUser(userId);
    if (!snapshot.isPremium) {
      const activeCount = await this.prisma.humidorItem.count({ where: { userId, deletedAt: null } });
      if (activeCount >= FREE_HUMIDOR_LIMIT) {
        throw new ForbiddenException(
          `Seu umidor gratuito já tem ${FREE_HUMIDOR_LIMIT} charutos. Assine o Premium para adicionar sem limites.`,
        );
      }
    }

    const item = await this.prisma.humidorItem.create({
      data: {
        userId,
        cigarId: dto.cigarId,
        quantity: dto.quantity ?? 1,
        acquiredAt: dto.acquiredAt ? new Date(dto.acquiredAt) : undefined,
        note: dto.note,
        pricePaid: dto.pricePaid,
      },
      include: { cigar: { include: { brand: true } } },
    });

    await this.domainEvents.publish(DomainEvent.HUMIDOR_ITEM_ADDED, {
      userId,
      humidorItemId: item.id,
      cigarId: item.cigarId,
    });

    return { ...item, readOnly: false };
  }

  /**
   * Lista TODOS os itens ativos, sem esconder nada além do limite — apenas
   * marca `readOnly: true` nos itens além do 25º (os 25 mais antigos por
   * `acquiredAt` permanecem editáveis).
   */
  async listMine(userId: string, page = 1, pageSize = 20) {
    const snapshot = await this.entitlements.resolveForUser(userId);
    const total = await this.prisma.humidorItem.count({ where: { userId, deletedAt: null } });

    let editableIds: Set<string> | null = null;
    if (!snapshot.isPremium && total > FREE_HUMIDOR_LIMIT) {
      const oldestEditable = await this.prisma.humidorItem.findMany({
        where: { userId, deletedAt: null },
        orderBy: [{ acquiredAt: 'asc' }, { id: 'asc' }],
        select: { id: true },
        take: FREE_HUMIDOR_LIMIT,
      });
      editableIds = new Set(oldestEditable.map((row) => row.id));
    }

    const items = await this.prisma.humidorItem.findMany({
      where: { userId, deletedAt: null },
      include: { cigar: { include: { brand: true } } },
      orderBy: [{ acquiredAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items: items.map((item) => ({
        ...item,
        readOnly: editableIds ? !editableIds.has(item.id) : false,
      })),
      total,
      page,
      pageSize,
    };
  }

  async updateItem(userId: string, itemId: string, dto: UpdateHumidorItemDto) {
    const item = await this.getOwnedActiveItem(userId, itemId);
    await this.assertEditable(userId, item);

    return this.prisma.humidorItem.update({
      where: { id: itemId },
      data: {
        quantity: dto.quantity,
        acquiredAt: dto.acquiredAt ? new Date(dto.acquiredAt) : undefined,
        note: dto.note,
        pricePaid: dto.pricePaid,
      },
    });
  }

  async removeItem(userId: string, itemId: string): Promise<void> {
    const item = await this.getOwnedActiveItem(userId, itemId);
    await this.assertEditable(userId, item);

    await this.prisma.humidorItem.update({ where: { id: itemId }, data: { deletedAt: new Date() } });
  }

  private async getOwnedActiveItem(userId: string, itemId: string): Promise<OwnedHumidorItem> {
    const item = await this.prisma.humidorItem.findFirst({
      where: { id: itemId, userId, deletedAt: null },
      select: { id: true, acquiredAt: true },
    });
    if (!item) throw new NotFoundException('Item do umidor não encontrado');
    return item;
  }

  /**
   * "Ao expirar, nada é apagado... fica visível em modo somente leitura"
   * (seção 6.2/6.3): recalcula a posição real do item (por `acquiredAt`
   * crescente, com `id` como desempate) a cada chamada — nunca confia em uma
   * lista fixa vinda do cliente.
   */
  private async assertEditable(userId: string, item: OwnedHumidorItem): Promise<void> {
    const snapshot = await this.entitlements.resolveForUser(userId);
    if (snapshot.isPremium) return;

    const rank = await this.prisma.humidorItem.count({
      where: {
        userId,
        deletedAt: null,
        OR: [{ acquiredAt: { lt: item.acquiredAt } }, { acquiredAt: item.acquiredAt, id: { lte: item.id } }],
      },
    });

    if (rank > FREE_HUMIDOR_LIMIT) {
      throw new ForbiddenException(
        'Este item está em modo somente leitura. Assine o Premium para editar todo o seu umidor.',
      );
    }
  }
}
