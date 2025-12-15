import { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';

type ResponseMetadata = OpenChoreoComponents['schemas']['ResponseMetadata'];

export interface PaginationResult<T> {
  items: T[];
  metadata?: ResponseMetadata;
}

/**
 * Maximum number of pages to fetch before considering it an infinite loop.
 * This is a safety limit to prevent runaway pagination and excessive memory usage.
 * With DEFAULT_PAGE_LIMIT of 512, this allows up to 25,600 items (50MB+ of memory).
 */
const MAX_PAGINATION_PAGES = 50;

/**
 * Generic helper to fetch all resources using cursor-based pagination.
 * Throws an error if any page fails to fetch or if pagination appears to be stuck.
 *
 * WARNING: This function loads all results into memory. For large datasets,
 * consider using chunked processing or streaming approaches.
 */
export async function fetchAllResources<T>(
  fetchPage: (cursor?: string) => Promise<PaginationResult<T> | null>,
): Promise<T[]> {
  const results: T[] = [];
  let continueToken: string | undefined;
  let previousToken: string | undefined;
  let pageCount = 0;

  do {
    // Check for potential infinite loop
    if (++pageCount > MAX_PAGINATION_PAGES) {
      throw new Error(
        `Pagination exceeded ${MAX_PAGINATION_PAGES} pages (${
          pageCount * 512
        } items estimated) - possible infinite loop detected or dataset too large for memory. Consider using chunked processing.`,
      );
    }

    // Warn about large memory usage
    if (pageCount === 10) {
      console.warn(
        `fetchAllResources: Loading ${
          pageCount * 512
        }+ items into memory. Consider chunked processing for large datasets.`,
      );
    }

    const response = await fetchPage(continueToken);

    if (!response) {
      throw new Error(
        `Failed to fetch page during pagination${
          continueToken ? ` (cursor: ${continueToken})` : ''
        }`,
      );
    }

    // Validate that the API is not returning the same token we just used
    if (
      response.metadata?.continue &&
      response.metadata.continue === continueToken
    ) {
      throw new Error(
        'Pagination token not advancing - possible API bug detected',
      );
    }

    // Detect if pagination token is not advancing (stuck in a loop)
    if (continueToken !== undefined && continueToken === previousToken) {
      throw new Error(
        'Pagination token not advancing - possible API bug detected',
      );
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

  return results;
}
