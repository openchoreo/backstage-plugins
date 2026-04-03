/**
 * A fully-mocked OpenChoreoClientApi backed by a Proxy.
 * Any method accessed on this object is automatically a `jest.fn()`,
 * so it never goes stale when new methods are added to the interface.
 *
 * Use with `TestApiProvider` to inject into components under test.
 *
 * @example
 * ```tsx
 * import { TestApiProvider } from '@backstage/test-utils';
 * import { openChoreoClientApiRef } from '@openchoreo/backstage-plugin';
 * import { createMockOpenChoreoClient } from '@openchoreo/test-utils';
 *
 * const mockClient = createMockOpenChoreoClient();
 * mockClient.getEnvironments.mockResolvedValue([...]);
 *
 * render(
 *   <TestApiProvider apis={[[openChoreoClientApiRef, mockClient]]}>
 *     <MyComponent />
 *   </TestApiProvider>
 * );
 * ```
 */
export type MockOpenChoreoClient = Record<string, jest.Mock>;

export function createMockOpenChoreoClient(
  overrides: Partial<Record<string, jest.Mock>> = {},
): MockOpenChoreoClient {
  const mocks: Record<string, jest.Mock> = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (value) {
      mocks[key] = value;
    }
  }

  return new Proxy(mocks, {
    get(target, prop: string) {
      if (!(prop in target)) {
        target[prop] = jest.fn();
      }
      return target[prop];
    },
  }) as MockOpenChoreoClient;
}
