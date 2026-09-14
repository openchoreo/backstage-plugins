import { screen, within } from '@testing-library/react';
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
  ProjectMetricGraph: ({ usageType, series }: any) => (
    <div
      data-testid="project-graph"
      data-usage-type={usageType}
      data-components={Object.keys(series).sort().join(',')}
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

const at = (value: number) => [
  { timestamp: '2026-03-05T10:00:00.000Z', value },
];

const HTTP_METRIC_KEYS = [
  'requestCount',
  'successfulRequestCount',
  'unsuccessfulRequestCount',
  'meanLatency',
  'latencyP50',
  'latencyP90',
  'latencyP99',
];

/** `byMetric` as the hook returns it: a point per component on every metric. */
const byMetricFor = (components: string[]) =>
  Object.fromEntries(
    HTTP_METRIC_KEYS.map(key => [
      key,
      Object.fromEntries(components.map(component => [component, at(1)])),
    ]),
  );

/** The mocked chart inside the card with this title. */
const graphIn = (title: string) =>
  within(
    screen.getByText(title).closest('.MuiCard-root') as HTMLElement,
  ).getByTestId('project-graph');

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
        byMetric: byMetricFor(['api', 'worker']),
        failedComponents: [],
      },
      error: undefined,
      refresh: jest.fn(),
    });
  });

  it('charts every component that returned data', async () => {
    await renderSection();

    expect(graphIn('Request Count')).toHaveAttribute(
      'data-components',
      'api,worker',
    );
    expect(screen.queryByText(/No HTTP metrics for/)).not.toBeInTheDocument();
  });

  it('gives each metric its own card, throughput first, then latency', async () => {
    await renderSection();

    const titles = Array.from(
      document.querySelectorAll('.MuiCardHeader-title'),
    ).map(node => node.textContent);
    expect(titles).toEqual([
      'Request Count',
      'Successful Request Count',
      'Unsuccessful Request Count',
      'Mean Latency',
      'Latency P50',
      'Latency P90',
      'Latency P99',
    ]);
    expect(
      screen
        .getAllByTestId('project-graph')
        .map(graph => graph.getAttribute('data-usage-type')),
    ).toEqual([
      'networkThroughput',
      'networkThroughput',
      'networkThroughput',
      'networkLatency',
      'networkLatency',
      'networkLatency',
      'networkLatency',
    ]);
  });

  it('renders the surviving charts and names the failed components', async () => {
    mockUseProjectMetrics.mockReturnValue({
      metrics: {
        byMetric: byMetricFor(['api']),
        failedComponents: [{ name: 'worker', error: 'nope' }],
      },
      error: undefined,
      refresh: jest.fn(),
    });

    await renderSection();

    expect(graphIn('Request Count')).toHaveAttribute('data-components', 'api');
    expect(screen.getByText(/No HTTP metrics for worker/)).toBeInTheDocument();
    expect(screen.getByText(/enabled for it/)).toBeInTheDocument();
  });

  it('pluralises the notice for several failed components', async () => {
    mockUseProjectMetrics.mockReturnValue({
      metrics: {
        byMetric: {},
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

    expect(screen.queryByTestId('project-graph')).not.toBeInTheDocument();
  });
});
