import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// Import from the sub-path (not the barrel) so this suite — which mocks
// @backstage/core-plugin-api — doesn't transitively load @backstage/test-utils'
// TestApiProvider (which runs attachComponentData at import and would break).
import { createQueryClientWrapper } from '@openchoreo/test-utils/src/queryClientBareWrapper';
import { CellDiagram } from './CellDiagram';

// useCellEnvironments is now backed by useOpenChoreoQuery, which needs a
// QueryClientProvider in the tree. Wrap in a fresh, retry-free cache each render
// (a bare provider, not TestApiProvider — this suite mocks core-plugin-api and
// supplies APIs through the useApi mock, so TestApiProvider isn't wanted).
const renderCell = () =>
  render(<CellDiagram />, { wrapper: createQueryClientWrapper() });

// ---- Mocks ----

jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: jest.fn(),
  catalogApiRef: { id: 'catalog' },
}));

// The component calls useNavigate() at render (for the node ⋮ menu's tab
// navigation); the tests render <CellDiagram> without a Router, so stub it.
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock('@backstage/core-plugin-api', () => ({
  useApi: jest.fn(),
  createApiRef: (def: { id: string }) => ({ id: def?.id ?? 'mock-api-ref' }),
  discoveryApiRef: { id: 'discovery' },
  fetchApiRef: { id: 'fetch' },
}));

jest.mock('@backstage/core-components', () => ({
  Progress: () => <div data-testid="progress">Loading...</div>,
}));

jest.mock('@openchoreo/cell-diagram', () => ({
  CellDiagram: ({ project, defaultDiagramLayer }: any) => (
    <div data-testid="cell-diagram-view" data-layer={defaultDiagramLayer}>
      {project?.id}
    </div>
  ),
  DiagramLayer: {
    ARCHITECTURE: 'architecture',
    OBSERVABILITY: 'observability',
    DIFF: 'diff',
  },
}));

jest.mock('@openchoreo/backstage-design-system', () => ({
  useChoreoTokens: () => ({ mode: 'light' }),
}));

jest.mock('@openchoreo/backstage-plugin-react', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // Keep the real caching wrapper (useCellEnvironments now calls
  // useOpenChoreoQuery). Pull it from its own module rather than the barrel so
  // we don't drag in the whole package (which imports the mocked core-plugin-api
  // and breaks on attachComponentData).
  const { useOpenChoreoQuery } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    jest.requireActual(
      '@openchoreo/backstage-plugin-react/src/hooks/useOpenChoreoQuery',
    );
  // Each recompute advances "now" (mirroring the real calculateTimeRange,
  // which uses `new Date()`), so the Refresh button produces a new fetch key
  // and triggers a refetch.
  let rangeCall = 0;
  return {
    useOpenChoreoQuery,
    EmptyState: ({ title, description, action }: any) => (
      <div data-testid="empty-state">
        <div>{title}</div>
        {description && <div>{description}</div>}
        {action && (
          <button onClick={action.onClick} aria-label={action.label}>
            {action.label}
          </button>
        )}
      </div>
    ),
    TimeRangeFilter: ({ value, onChange }: any) => (
      <select
        data-testid="time-range-filter"
        value={value}
        onChange={e => onChange?.({ timeRange: e.target.value })}
      >
        <option value="10m">Last 10 minutes</option>
        <option value="1h">Last 1 hour</option>
        <option value="24h">Last 24 hours</option>
      </select>
    ),
    calculateTimeRange: () => {
      rangeCall += 1;
      return {
        startTime: '2024-01-01T00:00:00.000Z',
        endTime: new Date(Date.UTC(2024, 0, 1, 1, 0, rangeCall)).toISOString(),
      };
    },
    // Mirrors the real hook so existing fetch/catalog mocks drive the env list.
    useProjectEnvironments: (
      projectName: string | undefined,
      namespaceName: string | undefined,
    ) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useApi } = require('@backstage/core-plugin-api');
      const discoveryApi = useApi({ id: 'discovery' });
      const fetchApi = useApi({ id: 'fetch' });
      const catalogApi = useApi({ id: 'catalog' });
      const [state, setState] = React.useState({
        environments: [],
        loading: true,
        error: null,
      });
      React.useEffect(() => {
        let cancelled = false;
        if (!projectName || !namespaceName) {
          setState({ environments: [], loading: false, error: null });
          return undefined;
        }
        (async () => {
          try {
            const baseUrl = await discoveryApi.getBaseUrl('openchoreo');
            const res = await fetchApi.fetch(
              `${baseUrl}/deployment-pipeline?projectName=${projectName}&namespaceName=${namespaceName}`,
            );
            const pipeline = await res.json();
            const ordered: string[] = [];
            const seen = new Set<string>();
            for (const path of pipeline?.promotionPaths ?? []) {
              const src =
                typeof path.sourceEnvironmentRef === 'string'
                  ? path.sourceEnvironmentRef
                  : path.sourceEnvironmentRef?.name;
              if (src && !seen.has(src)) {
                ordered.push(src);
                seen.add(src);
              }
              for (const t of path.targetEnvironmentRefs ?? []) {
                if (t.name && !seen.has(t.name)) {
                  ordered.push(t.name);
                  seen.add(t.name);
                }
              }
            }
            const { items } = await catalogApi.getEntities({
              filter: {
                kind: 'Environment',
                'metadata.namespace': namespaceName,
              },
            });
            const byName = new Map(items.map((e: any) => [e.metadata.name, e]));
            const envs = ordered.map(name => {
              const e: any = byName.get(name);
              const ann = e?.metadata?.annotations ?? {};
              return {
                name,
                displayName: e?.metadata?.title ?? name,
                namespace: ann['openchoreo.io/namespace'] ?? namespaceName,
                dataPlaneRef: {
                  name: ann['openchoreo.io/data-plane-ref'],
                  kind: ann['openchoreo.io/data-plane-ref-kind'] ?? 'DataPlane',
                },
              };
            });
            if (!cancelled) {
              setState({ environments: envs, loading: false, error: null });
            }
          } catch (err) {
            if (!cancelled) {
              setState({
                environments: [],
                loading: false,
                error: String(err),
              });
            }
          }
        })();
        return () => {
          cancelled = true;
        };
      }, [projectName, namespaceName, discoveryApi, fetchApi, catalogApi]);
      return state;
    },
    // Presentational <select> stub for the EnvironmentFilter
    EnvironmentFilter: ({ value, onChange, environments }: any) => {
      return (
        <select
          data-testid="env-select"
          value={value?.name ?? ''}
          onChange={e => {
            const next =
              environments?.find((env: any) => env.name === e.target.value) ??
              null;
            onChange?.(next);
          }}
        >
          {environments?.map((env: any) => (
            <option key={env.name} value={env.name}>
              {env.displayName ?? env.name}
            </option>
          ))}
        </select>
      );
    },
  };
});

jest.mock('@material-ui/core/styles', () => ({
  useTheme: () => ({
    palette: {
      background: { paper: '#fff' },
      warning: { light: '#ffd', contrastText: '#000' },
    },
  }),
}));

// MUI components — minimal stubs
jest.mock('@material-ui/core/Box', () => ({ children, ...rest }: any) => (
  <div {...rest}>{children}</div>
));
jest.mock('@material-ui/core/FormControl', () => ({ children }: any) => (
  <div>{children}</div>
));
jest.mock(
  '@material-ui/core/FormControlLabel',
  () =>
    ({ control, label }: any) =>
      (
        <label>
          {control}
          {label}
        </label>
      ),
);
jest.mock(
  '@material-ui/core/Switch',
  () =>
    ({ checked, onChange, disabled, inputProps }: any) =>
      (
        <input
          type="checkbox"
          role="switch"
          aria-label={inputProps?.['aria-label']}
          checked={!!checked}
          disabled={!!disabled}
          onChange={e => onChange?.({ target: { checked: e.target.checked } })}
        />
      ),
);
jest.mock('@material-ui/core/InputLabel', () => ({ children }: any) => (
  <label>{children}</label>
));
jest.mock('@material-ui/core/MenuItem', () => ({ children, value }: any) => (
  <option value={value}>{children}</option>
));
jest.mock(
  '@material-ui/core/Select',
  () =>
    ({ children, onChange, value, disabled, labelId }: any) =>
      (
        <select
          data-testid={
            labelId === 'cell-diagram-env-label' ? 'env-select' : 'select'
          }
          onChange={e => onChange?.({ target: { value: e.target.value } })}
          value={value}
          disabled={disabled}
        >
          {children}
        </select>
      ),
);
jest.mock('@material-ui/core/Tooltip', () => ({ children, title }: any) => (
  <div data-tooltip={typeof title === 'string' ? title : ''}>{children}</div>
));
jest.mock(
  '@material-ui/core/Typography',
  () =>
    ({ children, ...rest }: any) =>
      <span {...rest}>{children}</span>,
);
jest.mock('@material-ui/core/CircularProgress', () => () => (
  <div data-testid="spinner">loading</div>
));
jest.mock(
  '@material-ui/core/IconButton',
  () =>
    ({ children, onClick, disabled }: any) =>
      (
        <button aria-label="refresh" onClick={onClick} disabled={disabled}>
          {children}
        </button>
      ),
);
jest.mock('@material-ui/icons/Refresh', () => () => <span>Refresh</span>);

// ---- Helpers ----

const { useEntity } = jest.requireMock('@backstage/plugin-catalog-react');
const { useApi } = jest.requireMock('@backstage/core-plugin-api');

const mockEntity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'System',
  metadata: {
    name: 'my-project',
    namespace: 'default',
    annotations: { 'openchoreo.io/namespace': 'test-ns' },
  },
  spec: {},
};

const mkEnvEntity = (name: string, dp: string | undefined = 'dp-cilium') => ({
  metadata: {
    name,
    namespace: 'test-ns',
    annotations: dp
      ? {
          'openchoreo.io/namespace': 'test-ns',
          'openchoreo.io/data-plane-ref': dp,
          'openchoreo.io/data-plane-ref-kind': 'DataPlane',
        }
      : { 'openchoreo.io/namespace': 'test-ns' },
  },
});

const mockCatalogApi = {
  getEntities: jest.fn().mockResolvedValue({
    items: [mkEnvEntity('dev'), mkEnvEntity('prod')],
  }),
};

const mockDiscoveryApi = {
  getBaseUrl: jest.fn().mockImplementation(async (plugin: string) => {
    return `http://localhost/${plugin}`;
  }),
};

// Module-level state driving the fetchApi mock. Defaults set in beforeEach.
let mockPipeline: any = null;
let netPolProviderByDp: Record<string, string | undefined> = {};

let mockFetchApi: { fetch: jest.Mock };
const setNetPolResponses = (
  providerByDpName: Record<string, string | undefined>,
) => {
  netPolProviderByDp = providerByDpName;
};

const setPipeline = (pipeline: any) => {
  mockPipeline = pipeline;
};

const installFetchApi = () => {
  mockFetchApi = {
    fetch: jest.fn().mockImplementation(async (url: string) => {
      const u = new URL(url);
      if (u.pathname.endsWith('/deployment-pipeline')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockPipeline,
        };
      }
      // Default: netpol probe
      const dpName = u.searchParams.get('dpName') ?? '';
      const provider = netPolProviderByDp[dpName];
      return {
        ok: true,
        status: 200,
        json: async () => ({ networkPolicyProvider: provider ?? null }),
      };
    }),
  };
};

function setupMockClient(
  overrides: Partial<{
    getCellDiagramInfo: jest.Mock;
  }> = {},
) {
  const mockClient = {
    getCellDiagramInfo: jest.fn().mockResolvedValue({
      id: 'my-project',
      // Default has one component so the toggle renders; the "no components" path
      // is hidden in the empty state and is exercised by a dedicated test below.
      components: [{ id: 'svc-a', label: 'svc-a', services: {} }],
      connections: [],
    }),
    ...overrides,
  };
  useApi.mockImplementation((ref: { id: string }) => {
    if (ref.id === 'catalog') return mockCatalogApi;
    if (ref.id === 'discovery') return mockDiscoveryApi;
    if (ref.id === 'fetch') return mockFetchApi;
    return mockClient;
  });
  return mockClient;
}

beforeEach(() => {
  jest.clearAllMocks();
  useEntity.mockReturnValue({ entity: mockEntity });
  mockCatalogApi.getEntities.mockResolvedValue({
    items: [mkEnvEntity('dev'), mkEnvEntity('prod')],
  });
  // Default pipeline: dev → prod
  setPipeline({
    name: 'default-pipeline',
    promotionPaths: [
      {
        sourceEnvironmentRef: 'dev',
        targetEnvironmentRefs: [{ name: 'prod' }],
      },
    ],
  });
  // Default: both envs use a Cilium-enabled DataPlane
  setNetPolResponses({ 'dp-cilium': 'cilium' });
  installFetchApi();
});

describe('CellDiagram', () => {
  it('renders the cell diagram and defaults Runtime Network Observability OFF', async () => {
    const mockClient = setupMockClient();

    await act(async () => {
      renderCell();
    });

    await waitFor(() => {
      expect(screen.getByTestId('cell-diagram-view')).toBeInTheDocument();
    });

    // Toggle is rendered and OFF
    const toggle = screen.getByRole('switch', {
      name: /runtime network observability/i,
    });
    expect(toggle).not.toBeChecked();

    // Env/time-range selects and refresh hidden while OFF
    expect(screen.queryByTestId('env-select')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /refresh/i }),
    ).not.toBeInTheDocument();

    // The initial fetch must omit environmentName/startTime/endTime
    expect(mockClient.getCellDiagramInfo).toHaveBeenCalledWith(
      expect.anything(),
      { environmentName: undefined, startTime: undefined, endTime: undefined },
    );
  });

  it('reveals filters and refetches with env/time range when toggle is turned ON', async () => {
    const mockClient = setupMockClient();

    await act(async () => {
      renderCell();
    });

    await waitFor(() => {
      expect(screen.getByTestId('cell-diagram-view')).toBeInTheDocument();
    });

    const toggle = screen.getByRole('switch', {
      name: /runtime network observability/i,
    });

    await act(async () => {
      await userEvent.click(toggle);
    });

    // Env + time-range selects + refresh now visible
    expect(screen.getByTestId('env-select')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /refresh/i }),
    ).toBeInTheDocument();

    // Latest call must include the env and the time range
    await waitFor(() => {
      const lastCall =
        mockClient.getCellDiagramInfo.mock.calls[
          mockClient.getCellDiagramInfo.mock.calls.length - 1
        ];
      expect(lastCall[1]).toEqual(
        expect.objectContaining({
          environmentName: 'dev',
          startTime: expect.any(String),
          endTime: expect.any(String),
        }),
      );
    });
  });

  it('disables the toggle and shows tooltip when no env supports Cilium', async () => {
    setNetPolResponses({ 'dp-cilium': 'calico' });
    setupMockClient();

    await act(async () => {
      renderCell();
    });

    await waitFor(() => {
      expect(screen.getByTestId('cell-diagram-view')).toBeInTheDocument();
    });

    // The hook resolves async — wait for the disabled state to settle
    await waitFor(() => {
      const toggle = screen.getByRole('switch', {
        name: /runtime network observability/i,
      });
      expect(toggle).toBeDisabled();
    });

    expect(
      document.querySelector(
        '[data-tooltip*="Runtime network observability is unavailable in all environments. Configure the Cilium module to enable network observability."]',
      ),
    ).not.toBeNull();
  });

  it('shows per-env warning when selected env lacks Cilium', async () => {
    setNetPolResponses({ 'dp-cilium': 'cilium', 'dp-no-cilium': 'calico' });
    mockCatalogApi.getEntities.mockResolvedValue({
      items: [
        mkEnvEntity('dev', 'dp-cilium'),
        mkEnvEntity('staging', 'dp-no-cilium'),
      ],
    });
    setPipeline({
      name: 'default-pipeline',
      promotionPaths: [
        {
          sourceEnvironmentRef: 'dev',
          targetEnvironmentRefs: [{ name: 'staging' }],
        },
      ],
    });
    setupMockClient();

    await act(async () => {
      renderCell();
    });

    await waitFor(() => {
      expect(screen.getByTestId('cell-diagram-view')).toBeInTheDocument();
    });

    const toggle = screen.getByRole('switch', {
      name: /runtime network observability/i,
    });
    await act(async () => {
      await userEvent.click(toggle);
    });

    // Switch env from dev → staging
    const envSelect = screen.getByTestId('env-select');
    await act(async () => {
      await userEvent.selectOptions(envSelect, 'staging');
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Observability is unavailable in the/i),
      ).toBeInTheDocument();
    });
  });

  it('shows no-traffic hint when observations are empty and toggle is on', async () => {
    setupMockClient({
      getCellDiagramInfo: jest.fn().mockResolvedValue({
        id: 'my-project',
        components: [
          {
            id: 'svc',
            services: {
              main: {
                deploymentMetadata: {
                  gateways: { internet: { observations: [] } },
                },
              },
            },
          },
        ],
        connections: [],
      }),
    });

    await act(async () => {
      renderCell();
    });

    await waitFor(() => {
      expect(screen.getByTestId('cell-diagram-view')).toBeInTheDocument();
    });

    const toggle = screen.getByRole('switch', {
      name: /runtime network observability/i,
    });
    await act(async () => {
      await userEvent.click(toggle);
    });

    await waitFor(() => {
      expect(screen.getByText(/No HTTP traffic/i)).toBeInTheDocument();
    });
  });

  it('hides no-traffic hint when observations are present', async () => {
    setupMockClient({
      getCellDiagramInfo: jest.fn().mockResolvedValue({
        id: 'my-project',
        components: [
          {
            id: 'svc',
            services: {
              main: {
                deploymentMetadata: {
                  gateways: {
                    internet: {
                      isExposed: true,
                      observations: [{ requestCount: 10 }],
                    },
                  },
                },
              },
            },
          },
        ],
        connections: [],
      }),
    });

    await act(async () => {
      renderCell();
    });

    const toggle = screen.getByRole('switch', {
      name: /runtime network observability/i,
    });
    await act(async () => {
      await userEvent.click(toggle);
    });

    await waitFor(() => {
      expect(screen.getByTestId('cell-diagram-view')).toBeInTheDocument();
    });

    expect(screen.queryByText(/No HTTP traffic/i)).not.toBeInTheDocument();
  });

  it('defaults the diagram layer to observability when runtime data has observations', async () => {
    setupMockClient({
      getCellDiagramInfo: jest.fn().mockResolvedValue({
        id: 'my-project',
        components: [
          {
            id: 'svc',
            services: {
              main: {
                deploymentMetadata: {
                  gateways: {
                    internet: {
                      isExposed: true,
                      observations: [{ requestCount: 10 }],
                    },
                  },
                },
              },
            },
          },
        ],
        connections: [],
      }),
    });

    await act(async () => {
      renderCell();
    });

    // Toggle OFF → architecture
    await waitFor(() => {
      expect(screen.getByTestId('cell-diagram-view')).toHaveAttribute(
        'data-layer',
        'architecture',
      );
    });

    const toggle = screen.getByRole('switch', {
      name: /runtime network observability/i,
    });
    await act(async () => {
      await userEvent.click(toggle);
    });

    // Toggle ON + observations present → observability
    await waitFor(() => {
      expect(screen.getByTestId('cell-diagram-view')).toHaveAttribute(
        'data-layer',
        'observability',
      );
    });
  });

  it('keeps architecture layer when toggle is on but no observations yet', async () => {
    setupMockClient({
      getCellDiagramInfo: jest.fn().mockResolvedValue({
        id: 'my-project',
        components: [
          {
            id: 'svc',
            services: {
              main: {
                deploymentMetadata: {
                  gateways: { internet: { observations: [] } },
                },
              },
            },
          },
        ],
        connections: [],
      }),
    });

    await act(async () => {
      renderCell();
    });

    const toggle = screen.getByRole('switch', {
      name: /runtime network observability/i,
    });
    await act(async () => {
      await userEvent.click(toggle);
    });

    await waitFor(() => {
      expect(screen.getByTestId('cell-diagram-view')).toHaveAttribute(
        'data-layer',
        'architecture',
      );
    });
  });

  it('increments refresh nonce when Refresh button is clicked (toggle on)', async () => {
    const mockClient = setupMockClient();

    await act(async () => {
      renderCell();
    });

    await waitFor(() => {
      expect(screen.getByTestId('cell-diagram-view')).toBeInTheDocument();
    });

    const toggle = screen.getByRole('switch', {
      name: /runtime network observability/i,
    });
    await act(async () => {
      await userEvent.click(toggle);
    });

    const callsAfterToggle = mockClient.getCellDiagramInfo.mock.calls.length;

    const refreshButton = await screen.findByRole('button', {
      name: /refresh/i,
    });
    await act(async () => {
      await userEvent.click(refreshButton);
    });

    await waitFor(() => {
      expect(mockClient.getCellDiagramInfo.mock.calls.length).toBeGreaterThan(
        callsAfterToggle,
      );
    });
  });

  it('shows a "No components yet" empty state (and skips the cell diagram lib) when the project has no components', async () => {
    setupMockClient({
      getCellDiagramInfo: jest.fn().mockResolvedValue({
        id: 'my-project',
        components: [],
        connections: [],
      }),
    });

    await act(async () => {
      renderCell();
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('cell-diagram-no-components'),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/no components yet/i)).toBeInTheDocument();
    // The cell-diagram lib is intentionally not rendered for empty projects —
    // otherwise the standalone octagon outline looks awkward around the message.
    expect(screen.queryByTestId('cell-diagram-view')).not.toBeInTheDocument();
  });

  it('shows an empty state with Retry when the fetch fails (instead of an infinite spinner)', async () => {
    const mockClient = setupMockClient({
      getCellDiagramInfo: jest
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValue({
          id: 'my-project',
          components: [{ id: 'svc-a', label: 'svc-a', services: {} }],
          connections: [],
        }),
    });

    await act(async () => {
      renderCell();
    });

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('cell-diagram-view')).not.toBeInTheDocument();
    expect(screen.queryByTestId('progress')).not.toBeInTheDocument();

    const retry = screen.getByRole('button', { name: /retry/i });
    await act(async () => {
      await userEvent.click(retry);
    });

    await waitFor(() => {
      expect(screen.getByTestId('cell-diagram-view')).toBeInTheDocument();
    });
    expect(mockClient.getCellDiagramInfo).toHaveBeenCalledTimes(2);
  });
});
