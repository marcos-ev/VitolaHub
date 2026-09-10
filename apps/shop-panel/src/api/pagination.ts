import type { CursorPage } from '@charuto/shared';

/**
 * Percorre todas as páginas de um endpoint paginado por cursor até acabar
 * ou até `maxPages` (limite de segurança para não gerar uma sequência
 * infinita de requisições caso o backend nunca feche o cursor). Usado só
 * onde precisamos de um total agregado (ex. contagem de leads do período) —
 * para listas grandes, as telas usam paginação real com botão "carregar
 * mais" em vez disso.
 */
export async function fetchAllPages<T>(
  fetchPage: (cursor: string | null) => Promise<CursorPage<T>>,
  maxPages = 20,
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < maxPages; i++) {
    const page = await fetchPage(cursor);
    items.push(...page.items);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return items;
}
