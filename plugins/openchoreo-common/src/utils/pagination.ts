import { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';

type ResponseMetadata = OpenChoreoComponents['schemas']['ResponseMetadata'];

export interface PaginationResult<T> {
  items: T[];
  metadata?: ResponseMetadata;
}

/**
 * Default overall pagination timeout (ms). Can be overridden via options.
 */
export const DEFAULT_PAGINATION_TIMEOUT_MS = 60_000;

/**
 * Generic helper to fetch all resources using cursor-based pagination.
 */
export async function fetchAllResources<T>(
  fetchPage: (cursor?: string) => Promise<PaginationResult<T> | null>,
  options?: { timeoutMs?: number; signal?: AbortSignal },
): Promise<T[]> {
  const results: T[] = [];
  let continueToken: string | undefined;
  let previousToken: string | undefined;

  const timeoutMs = options?.timeoutMs ?? DEFAULT_PAGINATION_TIMEOUT_MS;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise =
    typeof timeoutMs === 'number'
      ? new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error(`Pagination timed out after ${timeoutMs} ms`)),
            timeoutMs,
          );
        })
      : undefined;

  const abortPromise = options?.signal
    ? new Promise<never>((_, reject) => {
        if (options.signal!.aborted) {
          reject(new Error('Pagination aborted'));
        } else {
          const onAbort = () => reject(new Error('Pagination aborted'));
          options.signal!.addEventListener('abort', onAbort, { once: true });
        }
      })
    : undefined;

  try {
    do {
      const fetchPromise = fetchPage(continueToken);

      const toAwait: Promise<any>[] = [fetchPromise];
      if (timeoutPromise) toAwait.push(timeoutPromise);
      if (abortPromise) toAwait.push(abortPromise);

      const response = (await Promise.race(toAwait)) as PaginationResult<T> | null;

      if (!response) {
        throw new Error(
          `Failed to fetch page during pagination${continueToken ? ` (cursor: ${continueToken})` : ''}`,
        );
      }

      // Validate that the API is not returning the same token we just used
      if (response.metadata?.continue && response.metadata.continue === continueToken) {
        throw new Error('Pagination token not advancing - possible API bug detected');
      }

      // Detect if pagination token is not advancing (stuck in a loop)
      if (continueToken !== undefined && continueToken === previousToken) {
        throw new Error('Pagination token not advancing - possible API bug detected');
      }

      results.push(...response.items);
      previousToken = continueToken;

      // Only continue if hasMore is true AND continue token is a non-empty string
      if (response.metadata?.hasMore && response.metadata.continue) {
        continueToken = response.metadata.continue;
      } else {
        continueToken = undefined;
      }
    } while (continueToken);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  return results;
}
