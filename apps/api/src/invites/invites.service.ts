import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface MyInvite {
  code: string;
  deepLink: string;
  webFallbackUrl: string;
  acceptedCount: number;
}

/**
 * Convites (seção 5.5). O código permanente já é gerado no cadastro
 * (`AuthService.register`) e a redenção acontece inteiramente lá — este
 * módulo só expõe o código do usuário e a contagem de convites aceitos.
 */
@Injectable()
export class InvitesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyInvite(userId: string): Promise<MyInvite> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { inviteCode: true } });
    if (!user?.inviteCode) throw new NotFoundException('Código de convite não encontrado para este usuário');

    const acceptedCount = await this.prisma.invite.count({
      where: { inviterId: userId, usedBy: { not: null } },
    });

    return {
      code: user.inviteCode,
      // Scheme `vitolahub` configurado em apps/mobile/app.json.
      deepLink: `vitolahub://convite/${user.inviteCode}`,
      // Site institucional ainda não existe; formato reservado para quando existir.
      webFallbackUrl: `https://vitolahub.com.br/convite/${user.inviteCode}`,
      acceptedCount,
    };
  }
}
