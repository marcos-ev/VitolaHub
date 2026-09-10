import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Guard de autorização do painel administrativo (seção "admin/"). Deve ser
// aplicado em TODOS os controllers do módulo `admin/`, sempre depois do
// `JwtAuthGuard` global (que já populou `request.user`). Confere
// `request.user.id` contra `User.isAdmin` a cada chamada — sem cache, pois
// revogar acesso de admin precisa ter efeito imediato.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.id;
    if (!userId) {
      throw new ForbiddenException('Acesso restrito a administradores');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      throw new ForbiddenException('Acesso restrito a administradores');
    }

    return true;
  }
}
