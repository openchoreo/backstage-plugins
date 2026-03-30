/**
 * Shape of the mock API client returned by createMockApiClient.
 * Each method is a jest.Mock that can be configured per test.
 */
export interface MockApiClient {
  GET: jest.Mock;
  POST: jest.Mock;
  PUT: jest.Mock;
  DELETE: jest.Mock;
  PATCH: jest.Mock;
}

/**
 * Creates a set of jest mock functions representing an OpenChoreo API client.
 * Use these mocks in your jest.mock() block for '@openchoreo/openchoreo-client-node'.
 *
 * @example
 * ```ts
 * const mocks = createMockApiClient();
 *
 * jest.mock('@openchoreo/openchoreo-client-node', () => ({
 *   ...jest.requireActual('@openchoreo/openchoreo-client-node'),
 *   createOpenChoreoApiClient: jest.fn(() => mocks),
 * }));
 * ```
 */
export function createMockApiClient(): MockApiClient {
  return {
    GET: jest.fn(),
    POST: jest.fn(),
    PUT: jest.fn(),
    DELETE: jest.fn(),
    PATCH: jest.fn(),
  };
}

/**
 * Creates a mock implementation for `fetchAllPages` that calls the provided
 * fetch function once with `undefined` cursor and returns the items array.
 * This matches the behavior used across all backend service tests.
 */
export function createMockFetchAllPages() {
  return jest.fn(
    (fetchPage: (cursor?: string) => Promise<any>) =>
      fetchPage(undefined).then((page: any) => page.items),
  );
}
