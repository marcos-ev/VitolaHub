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

function apiBase(): string {
  const fromEnv = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
  return fromEnv || '/api/v1';
}

export async function submitContact(payload: ContactPayload): Promise<void> {
  const res = await fetch(`${apiBase()}/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) detail = body.message.join(', ');
      else if (typeof body.message === 'string') detail = body.message;
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Falha ao enviar (${res.status})`);
  }
}
