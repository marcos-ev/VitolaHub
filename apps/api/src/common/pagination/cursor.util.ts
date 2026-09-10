// Paginação por cursor (createdAt + id como tie-breaker), nunca offset —
// usada por feed, catálogo, notificações, comentários, etc. O cursor é
// opaco para o cliente: um base64url de `{ createdAt, id }` do último item
// da página anterior.
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface DecodedCursor {
  createdAt: Date;
  id: string;
}

export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id })).toString('base64url');
}

export function decodeCursor(cursor: string | undefined | null): DecodedCursor | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      createdAt: string;
      id: string;
    };
    if (!parsed.createdAt || !parsed.id) return null;
    return { createdAt: new Date(parsed.createdAt), id: parsed.id };
  } catch {
    return null;
  }
}

/**
 * Recebe `limit + 1` itens ordenados por (createdAt desc, id desc) e devolve
 * a página + o cursor da próxima, sem precisar de COUNT() nem OFFSET.
 */
export function paginateResults<T extends { createdAt: Date; id: string }>(
  items: T[],
  limit: number,
): CursorPage<T> {
  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null;
  return { items: page, nextCursor };
}

export const DEFAULT_PAGE_SIZE = 20;
