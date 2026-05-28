import { renderHook, act } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import {
  useProjectContentsPage,
  type ProjectContentsPageParams,
} from './useProjectContentsPage';

// ---- Fixtures ----

const systemEntity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'System',
  metadata: {
    name: 'url-shortener',
    annotations: { [CHOREO_ANNOTATIONS.NAMESPACE]: 'default' },
  },
  spec: {},
} as any;

const componentEntity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'snip-api',
    namespace: 'default',
    title: 'snip-api',
    annotations: { [CHOREO_ANNOTATIONS.CREATED_AT]: '2026-05-01T00:00:00Z' },
  },
  spec: { type: 'deployment/service' },
};

const resourceEntity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Resource',
  metadata: {
    name: 'snip-pg',
    namespace: 'default',
    title: 'Postgres',
    annotations: { [CHOREO_ANNOTATIONS.CREATED_AT]: '2026-05-02T00:00:00Z' },
  },
  spec: { type: 'postgres' },
};

const mockCatalogApi = { queryEntities: jest.fn() };
const mockClient = {
  fetchReleaseBindings: jest.fn(),
  fetchResourceReleaseBindings: jest.fn(),
};

function renderPage(params: ProjectContentsPageParams) {
  return renderHook(() => useProjectContentsPage(params), {
    wrapper: ({ children }) => (
      <TestApiProvider
        apis={[
          [catalogApiRef, mockCatalogApi as any],
          [openChoreoClientApiRef, mockClient as any],
        ]}
      >
        {children}
      </TestApiProvider>
    ),
  });
}

const baseParams: ProjectContentsPageParams = {
  systemEntity,
  search: '',
  kinds: null,
  types: null,
  orderBy: 'name',
  orderDir: 'asc',
  cursor: undefined,
  limit: 5,
};

describe('useProjectContentsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCatalogApi.queryEntities.mockResolvedValue({
      items: [componentEntity, resourceEntity],
      totalItems: 2,
      pageInfo: { nextCursor: 'NEXT' },
    });
    mockClient.fetchReleaseBindings.mockResolvedValue({
      success: true,
      data: { items: [{ environment: 'development', status: 'Ready' }] },
    });
    mockClient.fetchResourceReleaseBindings.mockResolvedValue({
      success: true,
      data: { items: [{ environment: 'staging', status: 'NotReady' }] },
    });
  });

  it('queries both kinds scoped to the project, ordered by title for a name sort', async () => {
    const { result } = renderPage(baseParams);
    await act(async () => {});

    expect(mockCatalogApi.queryEntities).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 5,
        filter: {
          kind: ['Component', 'Resource'],
          'spec.system': 'url-shortener',
          'metadata.namespace': 'default',
        },
        orderFields: [{ field: 'metadata.title', order: 'asc' }],
      }),
    );
    expect(result.current.items).toHaveLength(2);
    expect(result.current.totalItems).toBe(2);
    expect(result.current.nextCursor).toBe('NEXT');
    expect(result.current.loading).toBe(false);
  });

  it('orders by the created-at annotation when sorting by createdAt', async () => {
    renderPage({ ...baseParams, orderBy: 'createdAt', orderDir: 'desc' });
    await act(async () => {});

    expect(mockCatalogApi.queryEntities).toHaveBeenCalledWith(
      expect.objectContaining({
        orderFields: [
          {
            field: `metadata.annotations.${CHOREO_ANNOTATIONS.CREATED_AT}`,
            order: 'desc',
          },
        ],
      }),
    );
  });

  it('adds a name-scoped full-text filter when searching', async () => {
    renderPage({ ...baseParams, search: 'snip' });
    await act(async () => {});

    expect(mockCatalogApi.queryEntities).toHaveBeenCalledWith(
      expect.objectContaining({
        fullTextFilter: {
          term: 'snip',
          fields: ['metadata.title', 'metadata.name'],
        },
      }),
    );
  });

  it('filters to the selected kinds and types', async () => {
    renderPage({
      ...baseParams,
      kinds: new Set(['resource']),
      types: new Set(['postgres']),
    });
    await act(async () => {});

    expect(mockCatalogApi.queryEntities).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.objectContaining({
          kind: ['Resource'],
          'spec.type': ['postgres'],
        }),
      }),
    );
  });

  it('sends a cursor request (no filter/order) when a cursor is given', async () => {
    renderPage({ ...baseParams, cursor: 'PAGE2' });
    await act(async () => {});

    expect(mockCatalogApi.queryEntities).toHaveBeenCalledWith({
      cursor: 'PAGE2',
      limit: 5,
    });
  });

  it('short-circuits to empty when every kind is cleared', async () => {
    const { result } = renderPage({ ...baseParams, kinds: new Set() });
    await act(async () => {});

    expect(mockCatalogApi.queryEntities).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('renders rows (loading false) before deployment bindings resolve', async () => {
    // Bindings never resolve, so only the catalog (phase 1) completes.
    mockClient.fetchReleaseBindings.mockReturnValue(new Promise(() => {}));
    mockClient.fetchResourceReleaseBindings.mockReturnValue(
      new Promise(() => {}),
    );

    const { result } = renderPage(baseParams);
    await act(async () => {});

    expect(result.current.loading).toBe(false);
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items.every(item => !item.deploymentLoaded)).toBe(
      true,
    );
  });

  it('enriches each row with its release-binding deployment status', async () => {
    const { result } = renderPage(baseParams);
    await act(async () => {});

    const component = result.current.items.find(i => i.kind === 'component')!;
    const resource = result.current.items.find(i => i.kind === 'resource')!;

    expect(mockClient.fetchReleaseBindings).toHaveBeenCalled();
    expect(mockClient.fetchResourceReleaseBindings).toHaveBeenCalled();
    expect(component.deploymentLoaded).toBe(true);
    expect(component.deploymentStatus.development).toEqual(
      expect.objectContaining({ isDeployed: true, status: 'Ready' }),
    );
    expect(resource.deploymentStatus.staging).toEqual(
      expect.objectContaining({ isDeployed: true, status: 'NotReady' }),
    );
  });
});
