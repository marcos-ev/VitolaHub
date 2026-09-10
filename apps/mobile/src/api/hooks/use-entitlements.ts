import { useQuery } from '@tanstack/react-query';
import { EntitlementSnapshot, FeatureKey } from '@charuto/shared';
import { apiFetch } from '../client';

// GET /entitlements/me — hook compartilhado de direitos de assinatura (seção
// 6.2/6.4). O backend é sempre a fonte da verdade: nunca liberamos um recurso
// no cliente sem essa confirmação. `staleTime` de alguns minutos evita
// requisições repetidas ao navegar entre telas protegidas, já que o plano do
// usuário muda com pouca frequência.
export function useEntitlements() {
  return useQuery({
    queryKey: ['entitlements', 'me'],
    queryFn: () => apiFetch<EntitlementSnapshot>('/entitlements/me'),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Verifica se uma feature está liberada no snapshot atual. Retorna `false`
 * (nunca `true` por omissão) enquanto o snapshot ainda não carregou, para
 * jamais expor um recurso premium antes da confirmação do backend.
 */
export function hasFeature(snapshot: EntitlementSnapshot | undefined, feature: FeatureKey): boolean {
  return snapshot?.features?.[feature] ?? false;
}
