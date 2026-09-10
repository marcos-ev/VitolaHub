import { apiFetch } from './client';

export type ShopPlanStatus = 'TRIAL' | 'ACTIVE' | 'CANCELED';

export interface ShopHours {
  seg?: string;
  ter?: string;
  qua?: string;
  qui?: string;
  sex?: string;
  sab?: string;
  dom?: string;
}

// Campos confirmados contra `model Shop` em `prisma/schema.prisma` (id,
// tradeName, address, lat, lng, whatsapp, instagram, hours, greetingMessage,
// avgResponseSeconds, responseRate, plan, isVerified já existem lá).
//
// SUPOSIÇÃO A RECONCILIAR: o endpoint `GET /api/v1/shops/me` em si ainda não
// existe (módulo `shops/` do backend está em construção em paralelo). Se ele
// não expuser exatamente essa rota "me", o mais provável é o dono da loja
// buscar via `GET /api/v1/shops/:id` usando um `shopId` que precisa vir
// embutido no usuário logado (ex. `/users/me` retornando `shopId`), ou então
// precisamos pedir ao time de backend um endpoint dedicado. Como toda a
// camada de UI só depende das funções deste arquivo, ajustar isso depois é
// uma mudança isolada aqui.
export interface Shop {
  id: string;
  tradeName: string;
  address: string;
  lat: number;
  lng: number;
  whatsapp: string | null;
  instagram: string | null;
  hours: ShopHours | null;
  greetingMessage: string | null;
  avgResponseSeconds: number | null;
  responseRate: number | null;
  plan: ShopPlanStatus;
  isVerified: boolean;
}

export function getMyShop(): Promise<Shop> {
  return apiFetch<Shop>('/shops/me');
}

export type UpdateShopPayload = Partial<
  Pick<
    Shop,
    'address' | 'lat' | 'lng' | 'whatsapp' | 'instagram' | 'hours' | 'greetingMessage'
  >
>;

// SUPOSIÇÃO: método/rota de atualização de perfil ainda não confirmados —
// assumindo PATCH sobre o mesmo recurso "me", que é o padrão mais comum.
export function updateMyShop(payload: UpdateShopPayload): Promise<Shop> {
  return apiFetch<Shop>('/shops/me', { method: 'PATCH', body: payload });
}

// SUPOSIÇÃO (documentada na tarefa): endpoint hipotético para disparar o
// relatório mensal por e-mail manualmente. Pode não existir ainda — o envio
// automático é responsabilidade do cron + EmailQueueService no backend.
export function sendMonthlyReportNow(): Promise<void> {
  return apiFetch<void>('/shops/me/send-report', { method: 'POST' });
}
