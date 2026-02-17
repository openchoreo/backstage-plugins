/**
 * Pagination utilities for the new cursor-based OpenChoreo API.
 *
 * @packageDocumentation
 */

interface PaginatedResponse<T> {
  items: T[];
  pagination?: {
    nextCursor?: string;
  };
}

/**
 * Fetches all pages from a cursor-based paginated API endpoint.
 *
 * @param fetchPage - Function that fetches a single page given an optional cursor.
 * @returns All items concatenated across every page.
 *
 * @example
 * ```typescript
 * const allProjects = await fetchAllPages(cursor =>
 *   client.GET('/api/v1/namespaces/{namespaceName}/projects', {
 *     params: {
 *       path: { namespaceName: 'my-ns' },
 *       query: { limit: 100, cursor },
 *     },
 *   }).then(res => {
 *     if (res.error) throw new Error('Failed to fetch projects');
 *     return res.data;
 *   }),
 * );
 * ```
 */
export async function fetchAllPages<T>(
  fetchPage: (cursor?: string) => Promise<PaginatedResponse<T>>,
): Promise<T[]> {
  const allItems: T[] = [];
  let cursor: string | undefined;

  do {
    const page = await fetchPage(cursor);
    allItems.push(...page.items);
    cursor = page.pagination?.nextCursor;
  } while (cursor);

  return allItems;
}
