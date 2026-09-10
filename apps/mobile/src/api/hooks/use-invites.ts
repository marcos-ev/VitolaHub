import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../client';

// GET /invites/me — confirmado contra apps/api/src/invites/invites.service.ts
// (InvitesService.getMyInvite): devolve exatamente estes 4 campos.
export interface MyInvite {
  code: string;
  deepLink: string;
  webFallbackUrl: string;
  acceptedCount: number;
}

export function useMyInviteQuery() {
  return useQuery({
    queryKey: ['invites', 'me'],
    queryFn: () => apiFetch<MyInvite>('/invites/me'),
  });
}
