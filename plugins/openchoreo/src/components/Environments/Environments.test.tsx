import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { mockComponentEntity } from '@openchoreo/test-utils';
import { Environments } from './Environments';

// ---- Mocks ----

// Mock styles (no-op)
jest.mock('./styles', () => ({
  useEnvironmentsStyles: jest.fn(),
}));

// Mock useNotification
jest.mock('../../hooks', () => ({
  useNotification: () => ({
    notification: null,
    showSuccess: jest.fn(),
    showError: jest.fn(),
  }),
}));

// Mock useEnvironmentData
const mockRefetch = jest.fn();
const mockUseEnvironmentData = jest.fn();
jest.mock('./hooks', () => ({
  useEnvironmentData: (...args: any[]) => mockUseEnvironmentData(...args),
  useStaleEnvironments: (environments: any[]) => ({
    displayEnvironments: environments,
    isPending: false,
  }),
  useEnvironmentPolling: jest.fn(),
  useEnvironmentRouting: () => ({
    state: { view: 'list' as const },
    navigateToList: jest.fn(),
    navigateToWorkloadConfig: jest.fn(),
    navigateToOverrides: jest.fn(),
    navigateToReleaseDetails: jest.fn(),
    goBack: jest.fn(),
  }),
}));

// Mock @backstage/core-components
jest.mock('@backstage/core-components', () => ({
  Progress: () => <div data-testid="progress">Loading...</div>,
}));

// Mock permission hooks from @openchoreo/backstage-plugin-react
const mockUseEnvironmentReadPermission = jest.fn();
const mockUseReleaseBindingPermission = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useEnvironmentReadPermission: () => mockUseEnvironmentReadPermission(),
  useReleaseBindingPermission: () => mockUseReleaseBindingPermission(),
  ForbiddenState: (props: any) => (
    <div data-testid="forbidden-state">
      <span>{props.message}</span>
      {props.onRetry && (
        <button onClick={props.onRetry} type="button">
          Retry
        </button>
      )}
    </div>
  ),
}));

// Mock the EnvironmentsRouter (renders child views)
jest.mock('./EnvironmentsRouter', () => ({
  EnvironmentsRouter: () => (
    <div data-testid="environments-router">Environments Content</div>
  ),
}));

// Mock NotificationBanner
jest.mock('./components', () => ({
  NotificationBanner: () => null,
}));

// ---- Helpers ----

const testEntity = mockComponentEntity();

function renderWithRouter(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <EntityProvider entity={testEntity}>{ui}</EntityProvider>
    </MemoryRouter>,
  );
}

// ---- Tests ----

describe('Environments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseEnvironmentReadPermission.mockReturnValue({
      canViewEnvironments: true,
      loading: false,
      deniedTooltip: '',
      permissionName: 'openchoreo.environment.read',
    });
    mockUseReleaseBindingPermission.mockReturnValue({
      canViewBindings: true,
      loading: false,
    });
  });

  it('shows loading progress when data is loading', () => {
    mockUseEnvironmentData.mockReturnValue({
      environments: [],
      loading: true,
      isForbidden: false,
      refetch: mockRefetch,
    });

    renderWithRouter(<Environments />);

    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('renders environments content when data loads', async () => {
    mockUseEnvironmentData.mockReturnValue({
      environments: [
        {
          name: 'development',
          deployment: { status: 'Ready' },
          endpoints: [],
        },
      ],
      loading: false,
      isForbidden: false,
      refetch: mockRefetch,
    });

    renderWithRouter(<Environments />);

    await waitFor(() => {
      expect(screen.getByTestId('environments-router')).toBeInTheDocument();
    });
    expect(screen.getByText('Environments Content')).toBeInTheDocument();
  });

  it('shows forbidden state when API returns forbidden', () => {
    mockUseEnvironmentData.mockReturnValue({
      environments: [],
      loading: false,
      isForbidden: true,
      refetch: mockRefetch,
    });

    renderWithRouter(<Environments />);

    expect(screen.getByTestId('forbidden-state')).toBeInTheDocument();
    expect(
      screen.getByText('You do not have permission to view deployments.'),
    ).toBeInTheDocument();
  });
});
