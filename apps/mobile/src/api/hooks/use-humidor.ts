import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EntitlementSnapshot, FREE_HUMIDOR_LIMIT } from '@charuto/shared';
import { apiFetch } from '../client';

// --- Tipos ------------------------------------------------------------------
//
// GET/POST/PATCH/DELETE /humidor — confirmados contra
// apps/api/src/humidor/{humidor.controller,humidor.service}.ts (o backend já
// existe). Duas diferenças em relação ao formato sugerido no enunciado
// (documentadas aqui, não é um "chute"):
//  1. `GET /humidor/me` devolve `{ items, total, page, pageSize }` (paginação
//     por página, não `{ items, readOnly }`) — o `readOnly` fica dentro de
//     CADA item, não no nível da resposta, porque o modo somente-leitura é
//     calculado por item (os N mais antigos continuam editáveis mesmo acima
//     do limite).
//  2. `cigar` embutido em cada item é o registro bruto do Prisma (com
//     `brand` aninhado, também bruto) — os campos numéricos `Decimal`
//     (`ratingAvg`, `pricePaid`) podem chegar como string no JSON. As funções
//     `normalize*` abaixo tratam essa serialização defensivamente.
export interface HumidorCigarBrand {
  id: string;
  name: string;
  countryCode: string;
}

export interface HumidorCigar {
  id: string;
  name: string;
  line: string | null;
  countryCode: string;
  vitola: string | null;
  imageUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
  brand: HumidorCigarBrand;
}

export interface HumidorItem {
  id: string;
  cigarId: string;
  quantity: number;
  acquiredAt: string;
  note: string | null;
  pricePaid: number | null;
  cigar: HumidorCigar;
  readOnly: boolean;
}

interface RawHumidorItem {
  id: string;
  cigarId: string;
  quantity: number;
  acquiredAt: string;
  note: string | null;
  pricePaid: number | string | null;
  readOnly: boolean;
  cigar: {
    id: string;
    name: string;
    line: string | null;
    countryCode: string;
    vitola: string | null;
    imageUrl: string | null;
    ratingAvg: number | string;
    ratingCount: number;
    brand: { id: string; name: string; countryCode: string };
  };
}

interface HumidorListResponse {
  items: RawHumidorItem[];
  total: number;
  page: number;
  pageSize: number;
}

function normalizeItem(raw: RawHumidorItem): HumidorItem {
  return {
    id: raw.id,
    cigarId: raw.cigarId,
    quantity: raw.quantity,
    acquiredAt: raw.acquiredAt,
    note: raw.note,
    pricePaid: raw.pricePaid == null ? null : Number(raw.pricePaid),
    readOnly: raw.readOnly,
    cigar: {
      id: raw.cigar.id,
      name: raw.cigar.name,
      line: raw.cigar.line,
      countryCode: raw.cigar.countryCode,
      vitola: raw.cigar.vitola,
      imageUrl: raw.cigar.imageUrl,
      ratingAvg: Number(raw.cigar.ratingAvg ?? 0),
      ratingCount: raw.cigar.ratingCount ?? 0,
      brand: raw.cigar.brand,
    },
  };
}

const PAGE_SIZE = 20;

// GET /humidor/me?page=&pageSize= — paginação por página (não cursor).
export function useHumidorListQuery() {
  return useInfiniteQuery({
    queryKey: ['humidor'],
    queryFn: ({ pageParam }: { pageParam: number }) =>
      apiFetch<HumidorListResponse>(`/humidor/me?page=${pageParam}&pageSize=${PAGE_SIZE}`),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.pageSize < lastPage.total ? lastPage.page + 1 : undefined,
    select: (data) => ({
      pages: data.pages.map((page) => ({ ...page, items: page.items.map(normalizeItem) })),
      pageParams: data.pageParams,
      total: data.pages[0]?.total ?? 0,
    }),
  });
}

export interface AddHumidorItemPayload {
  cigarId: string;
  quantity?: number;
  acquiredAt?: string;
  note?: string;
  pricePaid?: number;
}

// POST /humidor
export function useAddHumidorItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AddHumidorItemPayload) =>
      apiFetch<RawHumidorItem>('/humidor', { method: 'POST', body: payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['humidor'] }),
  });
}

export interface UpdateHumidorItemPayload {
  quantity?: number;
  acquiredAt?: string;
  note?: string;
  pricePaid?: number;
}

// PATCH /humidor/:id
export function useUpdateHumidorItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: UpdateHumidorItemPayload & { id: string }) =>
      apiFetch<RawHumidorItem>(`/humidor/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['humidor'] }),
  });
}

// DELETE /humidor/:id
export function useRemoveHumidorItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/humidor/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['humidor'] }),
  });
}

/**
 * GET /entitlements/me — endpoint pequeno duplicado aqui de propósito (ver
 * instruções do time): outro agente mobile já é dono de `use-entitlements.ts`
 * para o restante do app; para não colidir no mesmo arquivo, o umidor faz sua
 * própria chamada simples só para saber se o limite gratuito de
 * `FREE_HUMIDOR_LIMIT` itens se aplica ao usuário atual.
 */
export function useHumidorEntitlements() {
  return useQuery({
    queryKey: ['humidor', 'entitlements'],
    queryFn: () => apiFetch<EntitlementSnapshot>('/entitlements/me'),
    staleTime: 60_000,
  });
}

export { FREE_HUMIDOR_LIMIT };
