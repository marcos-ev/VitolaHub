import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '../client';

export type ContactType = 'contact' | 'founding' | 'support';

export interface ContactPayload {
  type: ContactType;
  name: string;
  email: string;
  message: string;
  subject?: string;
  tradeName?: string;
  city?: string;
  whatsapp?: string;
  instagram?: string;
}

/** Formulários públicos do site/app → e-mail para vitolahub@gmail.com. */
export function useSubmitContactMutation() {
  return useMutation({
    mutationFn: (payload: ContactPayload) =>
      apiFetch<{ ok: boolean }>('/contact', {
        method: 'POST',
        body: payload,
        auth: false,
      }),
  });
}
