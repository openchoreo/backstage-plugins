import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProjectComponentsCard } from './ProjectComponentsCard';

// ---- Mocks ----

// Mock styles
jest.mock('./styles', () => ({
  useProjectComponentsCardStyles: () => ({
    cardWrapper: 'cardWrapper',
    deploymentStatus: 'deploymentStatus',
    chipContainer: 'chipContainer',
    environmentChip: 'environmentChip',
    statusIconReady: 'statusIconReady',
    statusIconWarning: 'statusIconWarning',
    statusIconError: 'statusIconError',
    statusIconDefault: 'statusIconDefault',
    buildStatus: 'buildStatus',
    tooltipBuildName: 'tooltipBuildName',
    moreChip: 'moreChip',
    createComponentButton: 'createComponentButton',
  }),
}));

// Mock project hooks
const mockUseComponentsWithDeployment = jest.fn();
const mockUseEnvironments = jest.fn();
const mockUseDeploymentPipeline = jest.fn();
jest.mock('../hooks', () => ({
  useComponentsWithDeployment: (...args: any[]) =>
    mockUseComponentsWithDeployment(...args),
  useEnvironments: (...args: any[]) => mockUseEnvironments(...args),
  useDeploymentPipeline: () => mockUseDeploymentPipeline(),
}));

// Mock @backstage/plugin-catalog-react
jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => ({
    entity: {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'System',
      metadata: {
        name: 'test-project',
        namespace: 'default',
        annotations: {
          'openchoreo.io/namespace': 'test-ns',
        },
      },
      spec: {},
    },
  }),
}));

// Mock @backstage/core-plugin-api
jest.mock('@backstage/core-plugin-api', () => ({
  useApp: () => ({
    getSystemIcon: () => () => <span data-testid="system-icon" />,
  }),
}));

// Mock @backstage/core-components
jest.mock('@backstage/core-components', () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  Table: ({ title, data, columns, emptyContent, components: Comps }: any) => (
    <div data-testid="table">
      <div data-testid="table-title">{title}</div>
      {Comps?.Action && <Comps.Action action={{ onClick: jest.fn() }} />}
      {data.length === 0 ? (
        emptyContent
      ) : (
        <table>
          <thead>
            <tr>
              {columns.map((col: any) => (
                <th key={col.title}>{col.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row: any) => (
              <tr key={row.metadata.name} data-testid="table-row">
                {columns.map((col: any) =>
                  col.render ? (
                    <td key={col.title}>{col.render(row)}</td>
                  ) : (
                    <td key={col.title}>-</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  ),
  TableColumn: {},
}));

// Mock @openchoreo/backstage-plugin-react
const mockUseCreateComponentPath = jest.fn();
const mockUseReleaseBindingPermission = jest.fn();
const mockUseScopedComponentCreatePermission = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useCreateComponentPath: (...args: any[]) =>
    mockUseCreateComponentPath(...args),
  useReleaseBindingPermission: () => mockUseReleaseBindingPermission(),
  useScopedComponentCreatePermission: () =>
    mockUseScopedComponentCreatePermission(),
}));

// Mock DeleteEntity helpers
jest.mock('../../DeleteEntity', () => ({
  isMarkedForDeletion: () => false,
  DeletionBadge: () => null,
}));

// Mock error utils
jest.mock('../../../utils/errorUtils', () => ({
  isForbiddenError: () => false,
}));

// Mock shouldNavigateOnRowClick
jest.mock('../../../utils/shouldNavigateOnRowClick', () => ({
  shouldNavigateOnRowClick: () => true,
}));

// Mock sub-components
jest.mock('./DeploymentStatusCell', () => ({
  DeploymentStatusCell: () => (
    <span data-testid="deployment-status">Deployed</span>
  ),
}));
jest.mock('./BuildStatusCell', () => ({
  BuildStatusCell: () => <span data-testid="build-status">Build OK</span>,
}));

// ---- Helpers ----

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const defaultPermissions = () => {
  mockUseCreateComponentPath.mockReturnValue({
    path: '/create-component',
    loading: false,
  });
  mockUseReleaseBindingPermission.mockReturnValue({
    canViewBindings: true,
    loading: false,
  });
  mockUseScopedComponentCreatePermission.mockReturnValue({
    canCreate: true,
    loading: false,
    createDeniedTooltip: '',
  });
};

// ---- Tests ----

describe('ProjectComponentsCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    defaultPermissions();
  });

  it('shows loading state while data is being fetched', () => {
    mockUseComponentsWithDeployment.mockReturnValue({
      components: [],
      loading: true,
      error: null,
      refresh: jest.fn(),
    });
    mockUseEnvironments.mockReturnValue({
      environments: [],
      loading: true,
      error: null,
    });
    mockUseDeploymentPipeline.mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refetch: jest.fn(),
    });

    renderWithRouter(<ProjectComponentsCard />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    // Table should not render during loading
    expect(screen.queryByTestId('table')).not.toBeInTheDocument();
  });

  it('renders component list when data is loaded', () => {
    mockUseComponentsWithDeployment.mockReturnValue({
      components: [
        {
          apiVersion: 'backstage.io/v1alpha1',
          kind: 'Component',
          metadata: {
            name: 'my-service',
            namespace: 'default',
            description: 'A test service',
          },
          spec: { type: 'service' },
          deploymentStatus: {
            development: { isDeployed: true, status: 'Ready' },
          },
          latestBuild: { name: 'build-1', status: 'Succeeded' },
        },
        {
          apiVersion: 'backstage.io/v1alpha1',
          kind: 'Component',
          metadata: {
            name: 'my-web-app',
            namespace: 'default',
            description: 'A web application',
          },
          spec: { type: 'web' },
          deploymentStatus: {},
          latestBuild: { name: 'build-2', status: 'Running' },
        },
      ],
      loading: false,
      error: null,
      refresh: jest.fn(),
    });
    mockUseEnvironments.mockReturnValue({
      environments: [
        { name: 'development', displayName: 'Dev', isProduction: false },
      ],
      loading: false,
      error: null,
    });
    mockUseDeploymentPipeline.mockReturnValue({
      data: {
        name: 'default-pipeline',
        resourceName: 'default-pipeline',
        environments: ['development'],
      },
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    renderWithRouter(<ProjectComponentsCard />);

    // Table should render
    expect(screen.getByTestId('table')).toBeInTheDocument();
    expect(screen.getByTestId('table-title')).toHaveTextContent(
      'Has Components',
    );
    // Two rows rendered
    const rows = screen.getAllByTestId('table-row');
    expect(rows).toHaveLength(2);
    // Component names rendered as links
    expect(screen.getByText('my-service')).toBeInTheDocument();
    expect(screen.getByText('my-web-app')).toBeInTheDocument();
    // Types rendered
    expect(screen.getByText('service')).toBeInTheDocument();
    expect(screen.getByText('web')).toBeInTheDocument();
    // Create Component button present
    expect(screen.getByText('Create Component')).toBeInTheDocument();
  });

  it('shows empty state when no components exist', () => {
    mockUseComponentsWithDeployment.mockReturnValue({
      components: [],
      loading: false,
      error: null,
      refresh: jest.fn(),
    });
    mockUseEnvironments.mockReturnValue({
      environments: [],
      loading: false,
      error: null,
    });
    mockUseDeploymentPipeline.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    renderWithRouter(<ProjectComponentsCard />);

    expect(screen.getByTestId('table')).toBeInTheDocument();
    expect(
      screen.getByText('No components found in this project'),
    ).toBeInTheDocument();
    // Create Component button should still be available
    expect(screen.getByText('Create Component')).toBeInTheDocument();
  });
});
