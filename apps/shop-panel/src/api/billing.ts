import { apiFetch } from './client';

export type BillingPaymentMethod = 'card' | 'pix';

// Contrato confirmado em `apps/api/src/billing/billing.controller.ts` +
// `billing.service.ts` — endpoint já existe e funciona. Para `card`, o
// backend retorna `{ url, sessionId }` (URL do Stripe Checkout); para
// `pix`, retorna `{ clientSecret, paymentIntentId }` em vez disso — o painel
// só usa o fluxo de cartão (redirect), já que Pix depende de elemento
// dedicado do Stripe que não faz sentido implementar nesta primeira versão.
export interface CheckoutSession {
  url: string;
  sessionId: string;
}

export function checkoutShopPlan(paymentMethod: BillingPaymentMethod = 'card'): Promise<CheckoutSession> {
  return apiFetch<CheckoutSession>('/billing/checkout', {
    method: 'POST',
    body: { plan: 'SHOP_MONTHLY', paymentMethod },
  });
}
