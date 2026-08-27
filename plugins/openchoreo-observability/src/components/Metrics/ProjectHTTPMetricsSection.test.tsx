import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import { ProjectHTTPMetricsSection } from './ProjectHTTPMetricsSection';

// ---- Mocks (own hooks and child components only) ----

const mockUseProjectMetrics = jest.fn();
const mockUseDataPlaneNetPolProvider = jest.fn();

jest.mock('../../hooks', () => ({
  useProjectMetrics: (...args: any[]) => mockUseProjectMetrics(...args),
  useDataPlaneNetPolProvider: (...args: any[]) =>
    mockUseDataPlaneNetPolProvider(...args),
}));

jest.mock('./ProjectMetricGraph', () => ({
  ProjectMetricGraph: ({ usageType, seriesByComponent }: any) => (
    <div
      data-testid={`project-graph-${usageType}`}
      data-components={Object.keys(seriesByComponent).sort().join(',')}
    />
  ),
}));

// ---- Helpers ----

const defaultEnvironment = {
  uid: 'env-1',
  name: 'development',
  namespace: 'dev-ns',
  displayName: 'Development',
  isProduction: false,
  createdAt: '2024-01-01T00:00:00Z',
  dataPlaneRef: { kind: 'DataPlane', name: 'default-dp' },
};

const httpMetrics = {
  networkThroughput: {
    requestVolume: [{ timestamp: '2026-03-05T10:00:00.000Z', value: 12 }],
  },
  networkLatency: {
    p95: [{ timestamp: '2026-03-05T10:00:00.000Z', value: 30 }],
  },
};

function renderSection(components: string[] = ['api', 'worker']) {
  return renderInTestApp(
    <ProjectHTTPMetricsSection
      filters={{ environment: defaultEnvironment, timeRange: '1h' } as any}
      components={components}
      namespaceName="dev-ns"
      project="url-shortener"
      refreshNonce={0}
      enabled
    />,
  );
}

// ---- Tests ----

describe('ProjectHTTPMetricsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDataPlaneNetPolProvider.mockReturnValue({
      networkPolicyProvider: 'cilium',
      loading: false,
    });
    mockUseProjectMetrics.mockReturnValue({
      metrics: {
        byComponent: { api: httpMetrics, worker: httpMetrics },
        failedComponents: [],
      },
      error: undefined,
      refresh: jest.fn(),
    });
  });

  it('charts every component that returned data', async () => {
    await renderSection();

    expect(
      screen.getByTestId('project-graph-networkThroughput'),
    ).toHaveAttribute('data-components', 'api,worker');
    expect(screen.queryByText(/No HTTP metrics for/)).not.toBeInTheDocument();
  });

  it('renders the surviving charts and names the failed components', async () => {
    mockUseProjectMetrics.mockReturnValue({
      metrics: {
        byComponent: { api: httpMetrics },
        failedComponents: [{ name: 'worker', error: 'nope' }],
      },
      error: undefined,
      refresh: jest.fn(),
    });

    await renderSection();

    expect(
      screen.getByTestId('project-graph-networkThroughput'),
    ).toHaveAttribute('data-components', 'api');
    expect(screen.getByText(/No HTTP metrics for worker/)).toBeInTheDocument();
    expect(screen.getByText(/enabled for it/)).toBeInTheDocument();
  });

  it('pluralises the notice for several failed components', async () => {
    mockUseProjectMetrics.mockReturnValue({
      metrics: {
        byComponent: {},
        failedComponents: [
          { name: 'api', error: 'nope' },
          { name: 'worker', error: 'nope' },
        ],
      },
      error: undefined,
      refresh: jest.fn(),
    });

    await renderSection();

    expect(
      screen.getByText(/No HTTP metrics for api, worker/),
    ).toBeInTheDocument();
    expect(screen.getByText(/enabled for them/)).toBeInTheDocument();
  });

  it('shows the error alert instead of the notice when every request failed', async () => {
    mockUseProjectMetrics.mockReturnValue({
      metrics: undefined,
      error: 'Fan-out failed',
      refresh: jest.fn(),
    });

    await renderSection();

    expect(screen.getByText('Fan-out failed')).toBeInTheDocument();
    expect(screen.queryByText(/No HTTP metrics for/)).not.toBeInTheDocument();
  });

  it('renders nothing when the data plane is not on cilium', async () => {
    mockUseDataPlaneNetPolProvider.mockReturnValue({
      networkPolicyProvider: 'none',
      loading: false,
    });

    await renderSection();

    expect(
      screen.queryByTestId('project-graph-networkThroughput'),
    ).not.toBeInTheDocument();
  });
});
