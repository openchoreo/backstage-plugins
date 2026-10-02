/**
 * Pagination utilities for the new cursor-based OpenChoreo API.
 *
 * @packageDocumentation
 */

/**
 * A single page of items from a cursor-based paginated API endpoint.
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination?: {
    nextCursor?: string;
  };
}

/**
 * Optional guards that protect {@link fetchAllPages} against runaway
 * pagination. All of them throw rather than silently truncating results.
 */
export interface FetchAllPagesOptions {
  /** Hard cap on pages fetched. Exceeding it throws; it never silently truncates. */
  maxPages?: number;
  /** Wall-clock budget for the entire run. Defaults to 60_000; 0 disables the timeout. */
  timeoutMs?: number;
  /** Caller cancellation, checked at entry and between pages. */
  signal?: AbortSignal;
}

/** Default wall-clock budget for an entire pagination run, in milliseconds. */
const DEFAULT_TIMEOUT_MS = 60_000;

function describeCursor(cursor: string | undefined): string {
  return cursor === undefined ? 'undefined' : `"${cursor}"`;
}

function abortError(message: string): Error {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

/**
 * Fetches all pages from a cursor-based paginated API endpoint.
 *
 * A page whose `nextCursor` is `undefined`, `null` or `''` terminates the
 * loop. Broken or runaway pagination never silently truncates: a nullish
 * page, a page without an `items` array, a cursor that stops advancing,
 * more pages than `options.maxPages`, an expired `options.timeoutMs`
 * budget, and an aborted `options.signal` all throw.
 *
 * @param fetchPage - Function that fetches a single page given an optional cursor.
 * @param options - Optional guards; see {@link FetchAllPagesOptions}.
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
  fetchPage: (
    cursor?: string,
  ) => Promise<PaginatedResponse<T> | null | undefined>,
  options?: FetchAllPagesOptions,
): Promise<T[]> {
  const maxPages = options?.maxPages;
  const signal = options?.signal;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (signal?.aborted) {
    throw abortError('Pagination aborted before the first page was fetched');
  }

  const allItems: T[] = [];
  let cursor: string | undefined;
  let pageIndex = 0;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timeoutPromise: Promise<never> | undefined;
  if (timeoutMs > 0) {
    timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`Pagination timed out after ${timeoutMs} ms`)),
        timeoutMs,
      );
    });
  }

  let onAbort: (() => void) | undefined;
  let abortPromise: Promise<never> | undefined;
  if (signal) {
    abortPromise = new Promise<never>((_, reject) => {
      onAbort = () => reject(abortError('Pagination aborted'));
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  try {
    do {
      const page = await Promise.race([
        fetchPage(cursor),
        ...(timeoutPromise ? [timeoutPromise] : []),
        ...(abortPromise ? [abortPromise] : []),
      ]);

      const cursorDesc = describeCursor(cursor);

      if (page === null || page === undefined) {
        const returned = page === null ? 'null' : 'undefined';
        throw new Error(
          `Pagination failed: fetchPage returned ${returned} for page ${pageIndex} (cursor: ${cursorDesc})`,
        );
      }

      if (!Array.isArray(page.items)) {
        throw new Error(
          `Pagination failed: page ${pageIndex} did not return an items array (cursor: ${cursorDesc})`,
        );
      }

      const nextCursor = page.pagination?.nextCursor;
      if (cursor && nextCursor === cursor) {
        // nextCursor equals cursor here, so cursorDesc describes both.
        throw new Error(
          `Pagination is stuck: page ${pageIndex} returned nextCursor ${cursorDesc}, which is the cursor that was already used to fetch it`,
        );
      }

      allItems.push(...page.items);
      pageIndex += 1;

      if (maxPages !== undefined && pageIndex > maxPages) {
        throw new Error(
          `Pagination exceeded maxPages of ${maxPages} after ${pageIndex} pages and ${allItems.length} items collected`,
        );
      }

      // A nextCursor of undefined, null or '' all terminate the loop.
      cursor = nextCursor;
    } while (cursor);

    return allItems;
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    if (signal && onAbort) {
      signal.removeEventListener('abort', onAbort);
    }
  }
}
