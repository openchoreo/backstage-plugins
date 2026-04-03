import { render, screen } from '@testing-library/react';
import { EnvironmentCard } from './EnvironmentCard';
import type { EnvironmentCardProps, ItemActionTracker } from '../types';

// ---- Mocks ----

jest.mock('./LoadingSkeleton', () => ({
  LoadingSkeleton: ({ variant }: { variant: string }) => (
    <div data-testid={`loading-skeleton-${variant}`} />
  ),
}));

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  ForbiddenState: ({ message }: { message: string }) => (
    <div data-testid="forbidden-state">{message}</div>
  ),
  useDeployPermission: () => ({
    canDeploy: true,
    loading: false,
    deniedTooltip: '',
  }),
  useUndeployPermission: () => ({
    canUndeploy: true,
    loading: false,
    deniedTooltip: '',
  }),
  formatRelativeTime: (ts: string) => `relative(${ts})`,
}));

jest.mock('@openchoreo/backstage-design-system', () => ({
  Card: ({ children, ...rest }: any) => (
    <div data-testid="ds-card" {...rest}>
      {children}
    </div>
  ),
  StatusBadge: ({ status }: { status: string }) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

jest.mock('./InvokeUrlsDialog', () => ({
  InvokeUrlsDialog: () => null,
}));

jest.mock('./IncidentsBanner', () => ({
  IncidentsBanner: () => null,
}));

// ---- Helpers ----

function createTracker(
  overrides: Partial<ItemActionTracker> = {},
): ItemActionTracker {
  return {
    isActive: jest.fn().mockReturnValue(false),
    withTracking: jest.fn((_item: string, fn: () => Promise<any>) => fn()),
    activeItems: new Set<string>(),
    startAction: jest.fn(),
    endAction: jest.fn(),
    ...overrides,
  } as unknown as ItemActionTracker;
}

function renderCard(overrides: Partial<EnvironmentCardProps> = {}) {
  const defaultProps: EnvironmentCardProps = {
    environmentName: 'development',
    deployment: { status: 'Ready' },
    endpoints: [],
    isRefreshing: false,
    isAlreadyPromoted: jest.fn().mockReturnValue(false),
    actionTrackers: {
      promotionTracker: createTracker(),
      suspendTracker: createTracker(),
    },
    onRefresh: jest.fn(),
    onOpenOverrides: jest.fn(),
    onOpenReleaseDetails: jest.fn(),
    onPromote: jest.fn(),
    onSuspend: jest.fn(),
    onRedeploy: jest.fn(),
    ...overrides,
  };

  return render(<EnvironmentCard {...defaultProps} />);
}

// ---- Tests ----

describe('EnvironmentCard', () => {
  it('shows loading skeleton when isRefreshing is true', () => {
    renderCard({ isRefreshing: true });

    expect(screen.getByTestId('loading-skeleton-card')).toBeInTheDocument();
    expect(screen.queryByText('Deployment Status:')).not.toBeInTheDocument();
  });

  it('shows forbidden state when canViewBindings is false', () => {
    renderCard({
      canViewBindings: false,
      bindingsPermissionLoading: false,
    });

    expect(screen.getByTestId('forbidden-state')).toBeInTheDocument();
    expect(
      screen.getByText('You do not have permission to view release bindings.'),
    ).toBeInTheDocument();
  });

  it('renders header and content in normal state', () => {
    renderCard({
      environmentName: 'production',
      deployment: { status: 'Ready', releaseName: 'release-1' },
    });

    // Header: environment name
    expect(screen.getByText('production')).toBeInTheDocument();
    // Content: deployment status
    expect(screen.getByText('Deployment Status:')).toBeInTheDocument();
  });

  it('passes hasOverrides=true to header when hasComponentTypeOverrides', () => {
    renderCard({
      hasComponentTypeOverrides: true,
      deployment: { releaseName: 'release-1' },
    });

    // Settings icon should be present (header renders it when hasReleaseName is true)
    expect(
      screen.getByTitle('Configure environment overrides'),
    ).toBeInTheDocument();
  });

  it('does not show forbidden state while permissions are loading', () => {
    renderCard({
      canViewBindings: false,
      bindingsPermissionLoading: true,
    });

    // Should render content, not forbidden state
    expect(screen.queryByTestId('forbidden-state')).not.toBeInTheDocument();
    expect(screen.getByText('Deployment Status:')).toBeInTheDocument();
  });
});
