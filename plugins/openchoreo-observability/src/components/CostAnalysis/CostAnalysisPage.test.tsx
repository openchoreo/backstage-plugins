import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { CostAnalysisPage } from './CostAnalysisPage';

// Mock permissions
const mockUseRcaPermission = jest.fn();
const mockUseProjectEnvironments = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useRcaPermission: () => mockUseRcaPermission(),
  ForbiddenState: ({ message }: any) => (
    <div data-testid="forbidden-state">{message}</div>
  ),
  useProjectEnvironments: (...args: any[]) =>
    mockUseProjectEnvironments(...args),
}));

// Mock hooks
const mockUseUrlFilters = jest.fn();
const mockUseFinOpsReports = jest.fn();

jest.mock('../../hooks', () => ({
  useUrlFilters: (...args: any[]) => mockUseUrlFilters(...args),
  useFinOpsReports: (...args: any[]) => mockUseFinOpsReports(...args),
  useFinOpsReport: jest
    .fn()
    .mockReturnValue({ report: null, loading: false, error: null }),
  useFilters: jest.fn().mockReturnValue({ filters: {} }),
}));

// Mock child components
jest.mock('../RCA/RCAFilters', () => ({
  RCAFilters: () => <div data-testid="rca-filters" />,
}));

jest.mock('../RCA/RCAActions', () => ({
  RCAActions: () => <div data-testid="rca-actions" />,
}));

jest.mock('./CostAnalysisTable', () => ({
  CostAnalysisTable: ({ reports }: any) => (
    <div data-testid="cost-analysis-table">{reports.length} reports</div>
  ),
}));

jest.mock('./CostAnalysisReport', () => ({
  CostAnalysisReport: () => <div data-testid="cost-analysis-report" />,
}));

jest.mock('../RCA/RCAReport/EntityLinkContext', () => ({
  EntityLinkContext: { Provider: ({ children }: any) => <>{children}</> },
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

function setupDefaultMocks() {
  mockUseRcaPermission.mockReturnValue({
    canViewRca: true,
    loading: false,
    deniedTooltip: '',
    permissionName: '',
  });
  mockUseProjectEnvironments.mockReturnValue({
    environments: [defaultEnvironment],
    loading: false,
    status: 'ok',
    error: null,
  });
  mockUseUrlFilters.mockReturnValue({
    filters: { environment: defaultEnvironment, timeRange: '1h' },
    updateFilters: jest.fn(),
  });
  mockUseFinOpsReports.mockReturnValue({
    reports: [],
    loading: false,
    error: null,
    refresh: jest.fn(),
  });
}

async function renderPage() {
  return renderInTestApp(
    <EntityProvider entity={defaultEntity}>
      <CostAnalysisPage />
    </EntityProvider>,
  );
}

describe('CostAnalysisPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  it('shows progress while permission is loading', async () => {
    mockUseRcaPermission.mockReturnValue({
      canViewRca: false,
      loading: true,
      deniedTooltip: '',
      permissionName: '',
    });
    await renderPage();
    // Progress component renders — no forbidden or table should appear
    expect(screen.queryByTestId('cost-analysis-table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('forbidden-state')).not.toBeInTheDocument();
  });

  it('shows forbidden state when user lacks permission', async () => {
    mockUseRcaPermission.mockReturnValue({
      canViewRca: false,
      loading: false,
      deniedTooltip: 'No permission',
      permissionName: 'rca.view',
    });
    await renderPage();
    expect(screen.getByTestId('forbidden-state')).toBeInTheDocument();
    expect(screen.getByText('No permission')).toBeInTheDocument();
  });

  it('renders cost analysis table when user has permission', async () => {
    await renderPage();
    expect(screen.getByTestId('cost-analysis-table')).toBeInTheDocument();
  });

  it('shows error alert when reports fetch fails', async () => {
    mockUseFinOpsReports.mockReturnValue({
      reports: [],
      loading: false,
      error: 'Some unexpected error',
      refresh: jest.fn(),
    });
    await renderPage();
    expect(screen.getByText('Some unexpected error')).toBeInTheDocument();
  });

  it('shows info alert when observability is not enabled', async () => {
    mockUseFinOpsReports.mockReturnValue({
      reports: [],
      loading: false,
      error: 'Observability is not enabled for this component',
      refresh: jest.fn(),
    });
    await renderPage();
    expect(
      screen.getByText(/Observability is not enabled for this environment/),
    ).toBeInTheDocument();
  });

  it('shows info alert when FinOps service is not configured', async () => {
    mockUseFinOpsReports.mockReturnValue({
      reports: [],
      loading: false,
      error: 'FinOps service is not configured',
      refresh: jest.fn(),
    });
    await renderPage();
    expect(
      screen.getByText(/FinOps Agent is not configured/),
    ).toBeInTheDocument();
  });

  it('filters reports by search query', async () => {
    const reports = [
      {
        reportId: 'r1',
        namespace: 'dev',
        project: 'proj',
        timestamp: '2026-01-01T00:00:00Z',
        status: 'completed',
        component: 'api-service',
        summary: 'some summary',
      },
      {
        reportId: 'r2',
        namespace: 'dev',
        project: 'proj',
        timestamp: '2026-01-01T00:00:00Z',
        status: 'completed',
        component: 'worker',
        summary: 'other content',
      },
    ];
    mockUseFinOpsReports.mockReturnValue({
      reports,
      loading: false,
      error: null,
      refresh: jest.fn(),
    });
    mockUseUrlFilters.mockReturnValue({
      filters: {
        environment: defaultEnvironment,
        timeRange: '1h',
        searchQuery: 'api',
      },
      updateFilters: jest.fn(),
    });

    await renderPage();
    expect(screen.getByText('1 reports')).toBeInTheDocument();
  });
});
