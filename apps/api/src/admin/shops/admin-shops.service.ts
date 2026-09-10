import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CursorPage, DEFAULT_PAGE_SIZE, decodeCursor, paginateResults } from '../../common/pagination/cursor.util';
import { AssistedShopSignupDto } from './dto/assisted-signup.dto';
import { ListShopsDto } from './dto/list-shops.dto';

/**
 * Contratação assistida PJ (seção 6): o plano PJ (`SHOP_MONTHLY`) não tem
 * trial self-service — um admin cadastra/verifica o cadastro da loja aqui, e
 * o checkout via Stripe (já existente em `billing/**`) é chamado depois,
 * pelo dono da loja ou pelo próprio admin em nome dele.
 *
 * Acessa `this.prisma.shop` diretamente (tabela do Prisma), sem depender do
 * módulo `shops/` (que outro agente está construindo em paralelo).
 *
 * IMPORTANTE para reconciliar com o módulo `shops/`: `isVerified: true` deve
 * ser o filtro usado pelas buscas públicas de loja (proximidade, listagem)
 * — uma loja recém-cadastrada aqui nasce com `isVerified: false` e não deve
 * aparecer para os usuários finais até que `POST /admin/shops/:id/verify`
 * seja chamado.
 */
@Injectable()
export class AdminShopsService {
  constructor(private readonly prisma: PrismaService) {}

  async assistedSignup(dto: AssistedShopSignupDto) {
    const user = await this.prisma.user.findFirst({ where: { id: dto.userId, deletedAt: null } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    if (user.accountType !== 'PJ') {
      throw new BadRequestException('O usuário precisa ter accountType=PJ para receber uma loja');
    }

    const existing = await this.prisma.shop.findUnique({ where: { userId: dto.userId } });
    if (existing) throw new ConflictException('Este usuário já possui uma loja cadastrada');

    return this.prisma.shop.create({
      data: {
        userId: dto.userId,
        cnpj: dto.cnpj,
        tradeName: dto.tradeName,
        address: dto.address,
        lat: dto.lat,
        lng: dto.lng,
        whatsapp: dto.whatsapp,
        instagram: dto.instagram,
        plan: 'TRIAL',
        isVerified: false,
      },
    });
  }

  async verify(id: string) {
    const shop = await this.prisma.shop.findFirst({ where: { id, deletedAt: null } });
    if (!shop) throw new NotFoundException('Loja não encontrada');

    return this.prisma.shop.update({ where: { id }, data: { isVerified: true } });
  }

  async list(query: ListShopsDto): Promise<CursorPage<unknown>> {
    const cursor = decodeCursor(query.cursor);

    const shops = await this.prisma.shop.findMany({
      where: {
        deletedAt: null,
        ...(query.plan ? { plan: query.plan } : {}),
        ...(query.isVerified !== undefined ? { isVerified: query.isVerified === 'true' } : {}),
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
        user: { select: { id: true, username: true, displayName: true, email: true } },
      },
    });

    return paginateResults(shops, DEFAULT_PAGE_SIZE);
  }
}
