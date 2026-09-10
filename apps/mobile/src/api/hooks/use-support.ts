import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';

export type SupportTicketCategory = 'TECHNICAL' | 'SUGGESTION' | 'COMPLAINT' | 'OTHER';
export type SupportTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type SupportMessageAuthor = 'USER' | 'STAFF';

export interface SupportClientMeta {
  appVersion?: string;
  deviceModel?: string;
  osName?: string;
  osVersion?: string;
}

export interface SupportMessage {
  id: string;
  authorType: SupportMessageAuthor;
  authorLabel: string;
  body: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  code: string;
  category: SupportTicketCategory;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  attachmentUrls: string[];
  helpful: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicketDetail extends SupportTicket {
  clientMeta: SupportClientMeta | null;
  messages: SupportMessage[];
}

export interface CreateSupportTicketPayload {
  category: SupportTicketCategory;
  subject: string;
  message: string;
  attachmentUrls?: string[];
  clientMeta?: SupportClientMeta;
}

export function useMySupportTicketsQuery() {
  return useQuery({
    queryKey: ['support', 'tickets'],
    queryFn: () => apiFetch<SupportTicket[]>('/support/tickets'),
  });
}

export function useSupportTicketQuery(ticketId: string | undefined) {
  return useQuery({
    queryKey: ['support', 'ticket', ticketId],
    queryFn: () => apiFetch<SupportTicketDetail>(`/support/tickets/${ticketId}`),
    enabled: !!ticketId,
  });
}

export function useCreateSupportTicketMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSupportTicketPayload) =>
      apiFetch<SupportTicketDetail>('/support/tickets', { method: 'POST', body: payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] }),
  });
}

export function useAddSupportMessageMutation(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiFetch<SupportMessage>(`/support/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: { body },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support', 'ticket', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] });
    },
  });
}

export function useSupportFeedbackMutation(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (helpful: boolean) =>
      apiFetch<SupportTicket>(`/support/tickets/${ticketId}/feedback`, {
        method: 'PATCH',
        body: { helpful },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support', 'ticket', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] });
    },
  });
}
