import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DeploymentStatusCard } from './DeploymentStatusCard';

// ---- Mocks ----

// Mock useDeploymentStatus hook
const mockUseDeploymentStatus = jest.fn();
jest.mock('./useDeploymentStatus', () => ({
  useDeploymentStatus: () => mockUseDeploymentStatus(),
}));

// Mock permission hook
const mockUseEnvironmentReadPermission = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useEnvironmentReadPermission: () => mockUseEnvironmentReadPermission(),
  ForbiddenState: (props: any) => (
    <div data-testid="forbidden-state">{props.message}</div>
  ),
}));

// Mock design system Card
jest.mock('@openchoreo/backstage-design-system', () => ({
  Card: ({ children, ...props }: any) => (
    <div data-testid="ds-card" {...props}>
      {children}
    </div>
  ),
}));

// Mock @backstage/core-components
jest.mock('@backstage/core-components', () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

// Mock styles
jest.mock('./styles', () => ({
  useOverviewCardStyles: () => ({
    card: 'card',
    cardHeader: 'cardHeader',
    cardTitle: 'cardTitle',
    content: 'content',
    environmentChips: 'environmentChips',
    envChip: 'envChip',
    statusIconReady: 'statusIconReady',
    statusIconWarning: 'statusIconWarning',
    statusIconError: 'statusIconError',
    statusIconDefault: 'statusIconDefault',
    actions: 'actions',
    disabledState: 'disabledState',
    disabledIcon: 'disabledIcon',
  }),
}));

// ---- Helpers ----

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

// ---- Tests ----

describe('DeploymentStatusCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseEnvironmentReadPermission.mockReturnValue({
      canViewEnvironments: true,
      loading: false,
      deniedTooltip: '',
      permissionName: 'openchoreo.environment.read',
    });
  });

  it('shows loading skeleton when loading', () => {
    mockUseDeploymentStatus.mockReturnValue({
      environments: [],
      loading: true,
      error: null,
      isForbidden: false,
      refreshing: false,
      refresh: jest.fn(),
    });

    renderWithRouter(<DeploymentStatusCard />);

    // Skeleton elements from MUI Lab are rendered during loading
    // The card should be present and no "Deployments" title yet (skeleton placeholder instead)
    expect(screen.getByTestId('ds-card')).toBeInTheDocument();
    expect(screen.queryByText('Deployments')).not.toBeInTheDocument();
  });

  it('renders environment status chips when loaded', () => {
    mockUseDeploymentStatus.mockReturnValue({
      environments: [
        {
          name: 'development',
          deployment: { status: 'Ready' },
          endpoints: [],
        },
        {
          name: 'staging',
          deployment: { status: 'NotReady' },
          endpoints: [],
        },
        {
          name: 'production',
          deployment: { status: 'Failed' },
          endpoints: [],
        },
      ],
      loading: false,
      error: null,
      isForbidden: false,
      refreshing: false,
      refresh: jest.fn(),
    });

    renderWithRouter(<DeploymentStatusCard />);

    expect(screen.getByText('development')).toBeInTheDocument();
    expect(screen.getByText('staging')).toBeInTheDocument();
    expect(screen.getByText('production')).toBeInTheDocument();
    expect(screen.getByText('Go to Deploy')).toBeInTheDocument();
  });

  it('shows empty state with no environments', () => {
    mockUseDeploymentStatus.mockReturnValue({
      environments: [],
      loading: false,
      error: null,
      isForbidden: false,
      refreshing: false,
      refresh: jest.fn(),
    });

    renderWithRouter(<DeploymentStatusCard />);

    expect(screen.getByText('Deployments')).toBeInTheDocument();
    expect(screen.getByText('No environments configured')).toBeInTheDocument();
    expect(
      screen.getByText('Set up environments from the Deploy tab'),
    ).toBeInTheDocument();
    expect(screen.getByText('Go to Deploy')).toBeInTheDocument();
  });
});
