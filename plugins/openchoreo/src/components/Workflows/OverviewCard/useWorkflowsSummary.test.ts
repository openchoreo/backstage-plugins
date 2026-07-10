import { renderHook, waitFor, act } from '@testing-library/react';
import { Entity } from '@backstage/catalog-model';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useWorkflowsSummary } from './useWorkflowsSummary';

const entity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'checkout', namespace: 'default' },
  spec: { system: 'shop' },
};

jest.mock('@backstage/plugin-catalog-react', () => ({
  ...jest.requireActual('@backstage/plugin-catalog-react'),
  useEntity: () => ({ entity }),
}));

// Keep the real query/mutation seams; stub only the catalog-traversing entity
// resolver so we don't have to wire up the catalog API for the ref walk.
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  ...jest.requireActual('@openchoreo/backstage-plugin-react'),
  useComponentEntityDetails: () => ({
    getEntityDetails: jest.fn().mockResolvedValue({
      componentName: 'checkout',
      projectName: 'shop',
      namespaceName: 'ns-1',
    }),
  }),
}));

const okJsonResponse = (body: unknown) =>
  ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
  } as unknown as Response);

const errResponse = (status: number, statusText: string) =>
  ({
    ok: false,
    status,
    statusText,
    json: async () => ({}),
  } as unknown as Response);

const mockDiscoveryApi = { getBaseUrl: jest.fn() };
const mockFetchApi = { fetch: jest.fn() };

function renderUseWorkflowsSummary() {
  return renderHook(() => useWorkflowsSummary(), {
    wrapper: createQueryWrapper([
      [discoveryApiRef, mockDiscoveryApi as any],
      [fetchApiRef, mockFetchApi as any],
    ]),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDiscoveryApi.getBaseUrl.mockImplementation(async (id: string) =>
    id === 'openchoreo-workflows-backend'
      ? 'http://localhost/workflows'
      : 'http://localhost/openchoreo',
  );
});

describe('useWorkflowsSummary', () => {
  it('starts loading with no build or component details', () => {
    mockFetchApi.fetch.mockReturnValue(new Promise(() => {}));
    const { result } = renderUseWorkflowsSummary();

    expect(result.current.loading).toBe(true);
    expect(result.current.latestBuild).toBeNull();
    expect(result.current.componentDetails).toBeNull();
    expect(result.current.isRefetching).toBe(false);
  });

  it('resolves the latest build newest-first and exposes component details', async () => {
    mockFetchApi.fetch.mockImplementation(async (url: string) => {
      if (url.includes('/component?')) {
        return okJsonResponse({
          componentWorkflow: { name: 'build-and-push', kind: 'Workflow' },
        });
      }
      return okJsonResponse({
        items: [
          {
            name: 'run-old',
            status: 'Succeeded',
            createdAt: '2024-01-01T00:00:00Z',
          },
          {
            name: 'run-new',
            status: 'Succeeded',
            createdAt: '2024-06-01T00:00:00Z',
          },
        ],
      });
    });

    const { result } = renderUseWorkflowsSummary();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.latestBuild?.name).toBe('run-new');
    expect(result.current.hasWorkflows).toBe(true);
    expect(result.current.componentDetails).not.toBeNull();
    expect(result.current.error).toBeNull();
    // Background-refresh flag is exposed as `isRefetching` and settled.
    expect(result.current.isRefetching).toBe(false);
  });

  it('surfaces a component fetch failure as an error', async () => {
    mockFetchApi.fetch.mockImplementation(async (url: string) => {
      if (url.includes('/component?')) {
        return errResponse(500, 'boom');
      }
      return okJsonResponse({ items: [] });
    });

    const { result } = renderUseWorkflowsSummary();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.latestBuild).toBeNull();
    expect(result.current.error).toBeTruthy();
  });

  it('keeps latest build and flips isRefetching during a background refresh', async () => {
    let releaseSecond: (v: Response) => void = () => {};
    const secondRunsPending = new Promise<Response>(resolve => {
      releaseSecond = resolve;
    });
    const runsResponses = [
      okJsonResponse({ items: [{ name: 'run-1', status: 'Succeeded' }] }),
      secondRunsPending,
    ];
    let runsCall = 0;
    mockFetchApi.fetch.mockImplementation((url: string) => {
      if (url.includes('/component?')) {
        return Promise.resolve(
          okJsonResponse({ componentWorkflow: { name: 'wf' } }),
        );
      }
      return Promise.resolve(runsResponses[runsCall++]);
    });

    const { result } = renderUseWorkflowsSummary();
    await waitFor(() => expect(result.current.latestBuild?.name).toBe('run-1'));

    await act(async () => {
      result.current.refresh().catch(() => {});
    });

    await waitFor(() => expect(result.current.isRefetching).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(result.current.latestBuild?.name).toBe('run-1');

    await act(async () => {
      releaseSecond(
        okJsonResponse({ items: [{ name: 'run-2', status: 'Succeeded' }] }),
      );
      await secondRunsPending;
    });

    await waitFor(() => expect(result.current.latestBuild?.name).toBe('run-2'));
    expect(result.current.isRefetching).toBe(false);
  });

  it('surfaces a failed triggerBuild through error without throwing', async () => {
    mockFetchApi.fetch.mockImplementation(async (url: string, opts?: any) => {
      if (url.includes('/component?')) {
        return okJsonResponse({
          componentWorkflow: { name: 'build-and-push', kind: 'Workflow' },
        });
      }
      if (opts?.method === 'POST') {
        return errResponse(403, 'Forbidden');
      }
      return okJsonResponse({ items: [] });
    });

    const { result } = renderUseWorkflowsSummary();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasWorkflows).toBe(true);

    // triggerBuild swallows the rejection internally — surfaced via `error`.
    await act(async () => {
      await result.current.triggerBuild();
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.error?.message).toContain('403');
  });
});
