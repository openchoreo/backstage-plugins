import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { CostAnalysisReport } from './CostAnalysisReport';
import { finopsAgentApiRef } from '../../api/FinOpsAgentApi';
import { discoveryApiRef } from '@backstage/core-plugin-api';

const mockUseRcaPermission = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useRcaPermission: () => mockUseRcaPermission(),
  ForbiddenState: ({ message }: any) => (
    <div data-testid="forbidden-state">{message}</div>
  ),
}));

const mockUseFinOpsReport = jest.fn();
const mockUseFilters = jest.fn();
const mockUseGetEnvironmentsByNamespace = jest.fn();

jest.mock('../../hooks', () => ({
  useFinOpsReport: (...args: any[]) => mockUseFinOpsReport(...args),
  useFilters: () => mockUseFilters(),
  useGetEnvironmentsByNamespace: (...args: any[]) =>
    mockUseGetEnvironmentsByNamespace(...args),
}));

jest.mock('./CostAnalysisReportView', () => ({
  CostAnalysisReportView: ({ reportId }: any) => (
    <div data-testid="report-view">{reportId}</div>
  ),
}));

const defaultEntity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'System',
  metadata: {
    name: 'project-a',
    annotations: { 'openchoreo.io/namespace': 'dev' },
  },
  spec: { owner: 'group:default/team' },
};

const defaultEnvironment = {
  name: 'development',
  namespace: 'dev',
  isProduction: false,
  createdAt: '2026-01-01T00:00:00Z',
};

const mockReport = {
  reportId: 'r1',
  namespace: 'dev',
  project: 'proj',
  timestamp: '2026-01-01T00:00:00Z',
  status: 'completed' as const,
  report: null,
};

function setupDefaultMocks() {
  mockUseRcaPermission.mockReturnValue({
    canViewRca: true,
    loading: false,
    deniedTooltip: '',
    permissionName: '',
  });
  mockUseGetEnvironmentsByNamespace.mockReturnValue({
    environments: [defaultEnvironment],
    loading: false,
    error: null,
  });
  mockUseFilters.mockReturnValue({
    filters: { environment: defaultEnvironment },
  });
  mockUseFinOpsReport.mockReturnValue({
    report: mockReport,
    loading: false,
    error: null,
  });
}

const mockFinopsAgentApi = {
  updateActionStatuses: jest.fn().mockResolvedValue(undefined),
};

const mockDiscoveryApi = {
  getBaseUrl: jest
    .fn()
    .mockResolvedValue(
      'http://localhost:7007/api/openchoreo-observability-backend',
    ),
};

async function renderReport(routePath = '/r1') {
  return renderInTestApp(
    <TestApiProvider
      apis={[
        [finopsAgentApiRef, mockFinopsAgentApi],
        [discoveryApiRef, mockDiscoveryApi],
      ]}
    >
      <EntityProvider entity={defaultEntity}>
        <CostAnalysisReport />
      </EntityProvider>
    </TestApiProvider>,
    { routeEntries: [routePath] },
  );
}

describe('CostAnalysisReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  it('shows forbidden state when user lacks permission', async () => {
    mockUseRcaPermission.mockReturnValue({
      canViewRca: false,
      loading: false,
      deniedTooltip: 'No access',
      permissionName: 'rca.view',
    });
    await renderReport();
    expect(screen.getByTestId('forbidden-state')).toBeInTheDocument();
  });

  it('renders report view when report is loaded', async () => {
    await renderReport();
    expect(screen.getByTestId('report-view')).toBeInTheDocument();
  });

  it('shows error for FinOps service not configured', async () => {
    mockUseFinOpsReport.mockReturnValue({
      report: null,
      loading: false,
      error: 'FinOps service is not configured',
    });
    await renderReport();
    expect(
      screen.getByText(/FinOps Agent is not configured/),
    ).toBeInTheDocument();
  });

  it('shows error for observability not enabled', async () => {
    mockUseFinOpsReport.mockReturnValue({
      report: null,
      loading: false,
      error: 'Observability is not enabled',
    });
    await renderReport();
    expect(
      screen.getByText(/Observability is not enabled for this environment/),
    ).toBeInTheDocument();
  });

  it('shows generic error message', async () => {
    mockUseFinOpsReport.mockReturnValue({
      report: null,
      loading: false,
      error: 'Something went wrong',
    });
    await renderReport();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});
