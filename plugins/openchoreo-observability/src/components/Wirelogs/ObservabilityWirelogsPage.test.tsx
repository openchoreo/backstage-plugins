import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ObservabilityWirelogsPage } from './ObservabilityWirelogsPage';

// ---- Mocks ----------------------------------------------------------------

const mockUseWirelogsPermission = jest.fn();

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  __esModule: true,
  useWirelogsPermission: (...args: any[]) => mockUseWirelogsPermission(...args),
  ForbiddenState: ({ message, variant }: any) => (
    <div data-testid={`forbidden-${variant}`}>{message}</div>
  ),
  EnvironmentFilter: ({ value, onChange, environments }: any) => (
    <select
      data-testid="env-filter"
      value={value?.name ?? ''}
      onChange={e =>
        onChange(environments.find((env: any) => env.name === e.target.value))
      }
    >
      {environments.map((env: any) => (
        <option key={env.name} value={env.name}>
          {env.name}
        </option>
      ))}
    </select>
  ),
}));

jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => ({
    entity: {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: 'api',
        annotations: { 'openchoreo.io/component': 'api' },
      },
    },
  }),
}));

jest.mock('@openchoreo/backstage-plugin-common', () => ({
  CHOREO_ANNOTATIONS: { COMPONENT: 'openchoreo.io/component' },
}));

// The page calls useApi(alertApiRef); the plain `render` here has no
// Backstage API context, so override only useApi (keeping the real module
// otherwise, so core-components still loads) and expose the alert post spy.
jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  const alertPost = jest.fn();
  return {
    ...actual,
    useApi: jest.fn(() => ({ post: alertPost })),
    __alertPost: alertPost,
  };
});

// The soft-timeout dialog is covered by its own logic; render it as a no-op
// here so the page test stays focused on layout/state.
jest.mock('./WirelogsStreamTimeoutDialog', () => ({
  __esModule: true,
  WirelogsStreamTimeoutDialog: () => null,
}));

const alertPost = (jest.requireMock('@backstage/core-plugin-api') as any)
  .__alertPost as jest.Mock;

const mockUseGetNamespaceAndProjectByEntity = jest.fn().mockReturnValue({
  namespace: 'ns',
  project: 'proj',
});
const mockUseWirelogsEnvironments = jest.fn();
jest.mock('../../hooks', () => ({
  useGetNamespaceAndProjectByEntity: (...args: any[]) =>
    mockUseGetNamespaceAndProjectByEntity(...args),
  useWirelogsEnvironments: (...args: any[]) =>
    mockUseWirelogsEnvironments(...args),
}));

const mockUseWirelogsStream = jest.fn();
jest.mock('./useWirelogsStream', () => ({
  useWirelogsStream: (args: any) => mockUseWirelogsStream(args),
}));

jest.mock('./WirelogsFilter', () => ({
  WirelogsFilter: ({
    onDownload,
    onStart,
    onStop,
    onClear,
    status,
    disabled,
    startDisabled,
  }: any) => (
    <div
      data-testid="filter"
      data-disabled={String(!!disabled)}
      data-start-disabled={String(!!startDisabled)}
    >
      <span data-testid="status">{status}</span>
      <button onClick={onStart}>start</button>
      <button onClick={onStop}>stop</button>
      <button onClick={onClear}>clear</button>
      <button onClick={onDownload}>download</button>
    </div>
  ),
}));

jest.mock('./WirelogsTable', () => ({
  WirelogsTable: ({ flows }: any) => (
    <div data-testid="table">flows={flows.length}</div>
  ),
  matchesSearch: () => true,
}));

jest.mock('./WirelogsStats', () => ({
  WirelogsStats: ({ allowed, dropped, visibleCount, totalLoaded }: any) => (
    <div data-testid="stats">
      a={allowed} d={dropped} v={visibleCount} t={totalLoaded}
    </div>
  ),
}));

const startMock = jest.fn();
const stopMock = jest.fn();
const clearMock = jest.fn();

interface StreamState {
  flows: any[];
  status: string;
  error: string | null;
  totalReceived: number;
  startedAt: number | null;
  hardTimeoutMs: number | null;
  closedReason: 'user' | 'timeout' | 'error' | 'ended' | null;
  start: jest.Mock;
  stop: jest.Mock;
  clear: jest.Mock;
}

function setupStream(over: Partial<StreamState> = {}) {
  mockUseWirelogsStream.mockReturnValue({ ...defaultStream(), ...over });
}

function defaultStream(): StreamState {
  return {
    flows: [],
    status: 'idle',
    error: null,
    totalReceived: 0,
    startedAt: null,
    hardTimeoutMs: null,
    closedReason: null,
    start: startMock,
    stop: stopMock,
    clear: clearMock,
  };
}

const dev = {
  name: 'dev',
  displayName: 'Dev',
  namespace: 'dev-ns',
  isProduction: false,
  createdAt: '2026-01-01T00:00:00Z',
  dataPlaneRef: { name: 'dp-dev', kind: 'DataPlane' },
  hasWirelogs: true,
};
const stg = {
  name: 'stg',
  displayName: 'Staging',
  namespace: 'stg-ns',
  isProduction: false,
  createdAt: '2026-01-01T00:00:00Z',
  dataPlaneRef: { name: 'dp-stg', kind: 'DataPlane' },
  hasWirelogs: true,
};

function setupEnvironments(over: Partial<ReturnType<any>> = {}) {
  mockUseWirelogsEnvironments.mockReturnValue({
    environments: [dev, stg],
    loading: false,
    status: 'ok',
    error: null,
    refetch: jest.fn(),
    ...over,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setupStream();
  mockUseWirelogsPermission.mockReturnValue({
    canViewWirelogs: true,
    loading: false,
    deniedTooltip: '',
    permissionName: 'view-wirelogs',
  });
  setupEnvironments();
});

// ---- Tests ----------------------------------------------------------------

describe('ObservabilityWirelogsPage', () => {
  it('shows a progress indicator while the top-level permission is loading', () => {
    mockUseWirelogsPermission.mockReturnValueOnce({
      canViewWirelogs: false,
      loading: true,
      deniedTooltip: '',
      permissionName: 'view-wirelogs',
    });
    render(<ObservabilityWirelogsPage />);
    // While permission is loading, none of the page's content (toolbar /
    // forbidden state / table) should render yet.
    expect(screen.queryByTestId('filter')).not.toBeInTheDocument();
    expect(screen.queryByTestId('forbidden-fullpage')).not.toBeInTheDocument();
    expect(screen.queryByTestId('table')).not.toBeInTheDocument();
  });

  it('renders a fullpage forbidden state when the user lacks the wirelogs permission', () => {
    mockUseWirelogsPermission.mockReturnValueOnce({
      canViewWirelogs: false,
      loading: false,
      deniedTooltip: 'no wirelogs',
      permissionName: 'view-wirelogs',
    });
    render(<ObservabilityWirelogsPage />);
    expect(screen.getByTestId('forbidden-fullpage')).toHaveTextContent(
      'no wirelogs',
    );
  });

  it('renders the pipeline-unavailable notice when environments fail to load', () => {
    mockUseWirelogsEnvironments.mockReturnValueOnce({
      environments: [],
      loading: false,
      status: 'unavailable',
      error: 'broken',
      refetch: jest.fn(),
    });
    render(<ObservabilityWirelogsPage />);
    expect(
      screen.getByText(/Couldn't load this project's deployment pipeline/i),
    ).toBeInTheDocument();
  });

  it('renders the empty-pipeline notice when the pipeline has no environments', () => {
    mockUseWirelogsEnvironments.mockReturnValueOnce({
      environments: [],
      loading: false,
      status: 'empty-pipeline',
      error: null,
      refetch: jest.fn(),
    });
    render(<ObservabilityWirelogsPage />);
    expect(
      screen.getByText(
        /This project's deployment pipeline has no environments configured/i,
      ),
    ).toBeInTheDocument();
  });

  it('renders the stream error message under the toolbar', () => {
    setupStream({ status: 'error', error: 'kaboom' });
    render(<ObservabilityWirelogsPage />);
    expect(screen.getByText('kaboom')).toBeInTheDocument();
  });

  it('posts a toast when the stream closes due to the hard timeout', () => {
    setupStream({ status: 'closed', closedReason: 'timeout' });
    render(<ObservabilityWirelogsPage />);
    expect(alertPost).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'info',
        message: expect.stringContaining('maximum duration'),
      }),
    );
  });

  it('does not post the timeout toast for a user-stopped stream', () => {
    setupStream({ status: 'closed', closedReason: 'user' });
    render(<ObservabilityWirelogsPage />);
    expect(alertPost).not.toHaveBeenCalled();
  });

  it('shows a compact forbidden state for the selected environment when scoped permission is denied', async () => {
    mockUseWirelogsPermission
      // top-level (no args) call: allowed
      .mockReturnValueOnce({
        canViewWirelogs: true,
        loading: false,
        deniedTooltip: '',
        permissionName: 'view-wirelogs',
      })
      // env-scoped call: denied
      .mockReturnValue({
        canViewWirelogs: false,
        loading: false,
        deniedTooltip: 'no wirelogs in dev',
        permissionName: 'view-wirelogs',
      });

    render(<ObservabilityWirelogsPage />);
    await waitFor(() =>
      expect(screen.getByTestId('forbidden-compact')).toHaveTextContent(
        'no wirelogs in dev',
      ),
    );
  });

  it('renders the table and stats when env-scoped permission is allowed', async () => {
    setupStream({
      flows: [
        { flow: { uuid: 'a', verdict: 'FORWARDED' } } as any,
        { flow: { uuid: 'b', verdict: 'DROPPED' } } as any,
      ],
      totalReceived: 2,
    });
    render(<ObservabilityWirelogsPage />);
    await waitFor(() =>
      expect(screen.getByTestId('table')).toBeInTheDocument(),
    );
    // Stats reflect the verdict tallies.
    expect(screen.getByTestId('stats')).toHaveTextContent('a=1 d=1 v=2 t=2');
  });

  it('passes namespace, project, environment and component into the stream hook', async () => {
    render(<ObservabilityWirelogsPage />);
    await waitFor(() => {
      const lastCall =
        mockUseWirelogsStream.mock.calls[
          mockUseWirelogsStream.mock.calls.length - 1
        ][0];
      expect(lastCall).toEqual(
        expect.objectContaining({
          namespaceName: 'ns',
          projectName: 'proj',
          environmentName: 'dev',
          componentName: 'api',
        }),
      );
    });
  });

  it('downloads a JSON file via createElement + click + revokeObjectURL', () => {
    const createObjectURL = jest.fn(() => 'blob:url');
    const revokeObjectURL = jest.fn();
    (URL as any).createObjectURL = createObjectURL;
    (URL as any).revokeObjectURL = revokeObjectURL;

    setupStream({
      flows: [{ flow: { uuid: 'a' } } as any],
      totalReceived: 1,
    });

    render(<ObservabilityWirelogsPage />);

    const link = { click: jest.fn(), href: '', download: '' };
    const createSpy = jest
      .spyOn(document, 'createElement')
      .mockImplementationOnce(() => link as any);
    const appendSpy = jest
      .spyOn(document.body, 'appendChild')
      .mockImplementationOnce(node => node);
    const removeSpy = jest
      .spyOn(document.body, 'removeChild')
      .mockImplementationOnce(node => node);

    fireEvent.click(screen.getByText('download'));

    expect(createSpy).toHaveBeenCalledWith('a');
    expect(link.click).toHaveBeenCalled();
    expect(link.download).toMatch(/^wirelogs-proj-dev-/);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:url');

    createSpy.mockRestore();
    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('disables the toolbar and shows a Cilium warning when no environment supports wirelogs', async () => {
    setupEnvironments({
      environments: [
        { ...dev, hasWirelogs: false },
        { ...stg, hasWirelogs: false },
      ],
    });
    render(<ObservabilityWirelogsPage />);
    await waitFor(() =>
      expect(screen.getByTestId('filter')).toHaveAttribute(
        'data-disabled',
        'true',
      ),
    );
    expect(
      screen.getByText(/any of this project's environments/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('table')).not.toBeInTheDocument();
  });

  it('warns and disables Start (but not the env selector) when the selected env cannot stream but another can', async () => {
    setupEnvironments({
      environments: [{ ...dev, hasWirelogs: false }, stg],
    });
    render(<ObservabilityWirelogsPage />);
    await waitFor(() =>
      expect(screen.getByTestId('filter')).toHaveAttribute(
        'data-start-disabled',
        'true',
      ),
    );
    expect(screen.getByTestId('filter')).toHaveAttribute(
      'data-disabled',
      'false',
    );
    expect(screen.getByText(/unavailable in the/i).textContent).toMatch(/Dev/);
    expect(screen.queryByTestId('table')).not.toBeInTheDocument();
  });

  it('stops an in-flight stream when the selected environment cannot stream wirelogs', async () => {
    setupStream({ status: 'streaming' });
    setupEnvironments({
      environments: [{ ...dev, hasWirelogs: false }, stg],
    });
    render(<ObservabilityWirelogsPage />);
    await waitFor(() => expect(stopMock).toHaveBeenCalled());
  });
});
