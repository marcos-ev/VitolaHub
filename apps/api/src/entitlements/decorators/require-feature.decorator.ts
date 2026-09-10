import { SetMetadata } from '@nestjs/common';
import { FeatureKey } from '@charuto/shared';

export const REQUIRE_FEATURE_KEY = 'requireFeature';

/**
 * Marca uma rota como dependente de uma feature Premium (seção 6.4). Combine
 * com `EntitlementsGuard` (`@UseGuards(EntitlementsGuard)`) para bloquear com
 * 403 quando o snapshot resolvido pelo `EntitlementsService` não liberar a
 * feature. Nenhuma rota usa isso ainda nesta fase — é utilitário pronto para
 * os módulos de reconhecimento por foto e estatísticas (fases seguintes).
 */
export const RequireFeature = (feature: FeatureKey) => SetMetadata(REQUIRE_FEATURE_KEY, feature);
