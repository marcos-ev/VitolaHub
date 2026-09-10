import { useCallback, useEffect, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { CursorPage } from '@charuto/shared';
import { apiFetch } from '../client';

// --- Localização --------------------------------------------------------
//
// `GET /shops` (ver apps/api/src/shops/dto/list-shops.dto.ts) exige `lat`/
// `lng` sempre — não existe busca "só por cidade" sem coordenadas. Por isso,
// quando o usuário nega a permissão de localização, caímos para um centro
// fixo (capital de SP) com um raio bem maior, para que o filtro manual de
// cidade ainda funcione razoavelmente. Isso é documentado como limitação no
// resumo final do agente.
export interface Coordinates {
  lat: number;
  lng: number;
}

export const FALLBACK_COORDINATES: Coordinates = { lat: -23.5505, lng: -46.6333 };
export const FALLBACK_RADIUS_KM = 500;
export const DEFAULT_RADIUS_KM = 30;

export type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'error';

export function useDeviceLocation() {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [coords, setCoords] = useState<Coordinates | null>(null);

  const requestLocation = useCallback(async () => {
    setStatus('requesting');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setStatus('denied');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      setStatus('granted');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  return { status, coords, requestLocation };
}

// --- Charutarias ----------------------------------------------------------
//
// GET /shops?lat=&lng=&radiusKm=&city=&cursor= e GET /shops/:id — confirmados
// contra apps/api/src/shops/{shops.controller,shops.service}.ts (o backend já
// existe; o enunciado avisava que "outro agente de backend" poderia estar
// criando este módulo agora, mas ele já estava pronto no momento desta
// implementação). Duas limitações herdadas do backend, documentadas também no
// resumo final:
//  1. O item de LISTA não traz `ratingAvg`/`ratingCount` (só o detalhe traz)
//     — mostramos distância + selo de verificado + indicador de resposta na
//     lista, e a nota média só aparece na ficha da loja.
//  2. Não há fotos de loja no schema atual — a ficha da loja não exibe galeria.
export interface ShopListItem {
  id: string;
  tradeName: string;
  address: string;
  lat: number;
  lng: number;
  whatsapp: string | null;
  instagram: string | null;
  isVerified: boolean;
  plan: string;
  avgResponseSeconds: number | null;
  responseRate: number | null;
  distanceKm: number;
}

export interface ShopsNearbyParams {
  lat: number;
  lng: number;
  city?: string;
  radiusKm?: number;
}

export function useShopsNearbyQuery(params: ShopsNearbyParams | null) {
  return useInfiniteQuery({
    queryKey: ['shops', 'nearby', params?.lat, params?.lng, params?.city, params?.radiusKm],
    queryFn: ({ pageParam }: { pageParam: string | null }) => {
      const search = new URLSearchParams({
        lat: String(params!.lat),
        lng: String(params!.lng),
        radiusKm: String(params?.radiusKm ?? DEFAULT_RADIUS_KM),
      });
      if (params?.city) search.set('city', params.city);
      if (pageParam) search.set('cursor', pageParam);
      return apiFetch<CursorPage<ShopListItem>>(`/shops?${search.toString()}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!params,
    retry: false,
  });
}

export interface ShopReviewer {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ShopReview {
  id: string;
  rating: number;
  body: string | null;
  user: ShopReviewer | null;
  createdAt: string;
}

export interface ShopDetail {
  id: string;
  tradeName: string;
  cnpj: string;
  address: string;
  lat: number;
  lng: number;
  whatsapp: string | null;
  instagram: string | null;
  isVerified: boolean;
  plan: string;
  // SUPOSIÇÃO: `hours` é um JSON livre (`Json?` no schema) sem formato
  // documentado. Tratamos como `Record<string, string>` (ex.: { "seg-sex":
  // "09:00-19:00" }) na tela, com fallback silencioso se vier em outro formato.
  hours: unknown;
  avgResponseSeconds: number | null;
  responseRate: number | null;
  ratingAvg: number;
  ratingCount: number;
  recentReviews: ShopReview[];
  createdAt: string;
}

export function useShopDetailQuery(shopId: string | undefined) {
  return useQuery({
    queryKey: ['shops', shopId],
    queryFn: () => apiFetch<ShopDetail>(`/shops/${shopId}`),
    enabled: !!shopId,
  });
}

// POST /shops/:id/reviews — { rating, body? }
export function useCreateShopReviewMutation(shopId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { rating: number; body?: string }) =>
      apiFetch(`/shops/${shopId}/reviews`, { method: 'POST', body: payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shops', shopId] }),
  });
}
