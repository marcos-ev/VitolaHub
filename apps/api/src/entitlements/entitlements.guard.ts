import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureKey } from '@charuto/shared';
import { EntitlementsService } from './entitlements.service';
import { REQUIRE_FEATURE_KEY } from './decorators/require-feature.decorator';

/**
 * Guard parametrizável por `@RequireFeature(FeatureKey.X)`. Roda depois do
 * `JwtAuthGuard` global (precisa de `request.user`) e sempre resolve o
 * snapshot via `EntitlementsService`, nunca confia em nada vindo do cliente.
 */
@Injectable()
export class EntitlementsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<FeatureKey | undefined>(REQUIRE_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!feature) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.id) throw new ForbiddenException('Autenticação necessária');

    const snapshot = await this.entitlements.resolveForUser(user.id);
    if (!snapshot.features[feature]) {
      throw new ForbiddenException('Este recurso é exclusivo para assinantes Premium');
    }
    return true;
  }
}
