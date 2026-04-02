import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { WorkflowsOverviewCard } from './WorkflowsOverviewCard';

// ---- Mocks ----

jest.mock('@openchoreo/backstage-design-system', () => ({
  Card: ({ children, ...rest }: any) => (
    <div data-testid="ds-card" {...rest}>
      {children}
    </div>
  ),
}));

jest.mock('@backstage/core-components', () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

jest.mock('../BuildStatusChip', () => ({
  BuildStatusChip: ({ status }: { status: string }) => (
    <span data-testid="build-status-chip">{status}</span>
  ),
}));

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useBuildPermission: () => mockUseBuildPermission(),
  ForbiddenState: ({ message }: any) => (
    <div data-testid="forbidden-state">{message}</div>
  ),
  formatRelativeTime: (ts: string) => `relative(${ts})`,
}));

const mockUseWorkflowsSummary = jest.fn();
jest.mock('./useWorkflowsSummary', () => ({
  useWorkflowsSummary: () => mockUseWorkflowsSummary(),
}));

const mockUseBuildPermission = jest.fn();

// ---- Helpers ----

const defaultPermission = {
  canBuild: true,
  canView: true,
  viewBuildDeniedTooltip: '',
  triggerLoading: false,
  viewLoading: false,
  triggerBuildDeniedTooltip: '',
};

function renderCard() {
  return render(
    <MemoryRouter>
      <WorkflowsOverviewCard />
    </MemoryRouter>,
  );
}

// ---- Tests ----

describe('WorkflowsOverviewCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseBuildPermission.mockReturnValue(defaultPermission);
  });

  it('shows forbidden state when view permission is denied', () => {
    mockUseBuildPermission.mockReturnValue({
      ...defaultPermission,
      canView: false,
      viewLoading: false,
      viewBuildDeniedTooltip: 'No permission to view builds',
    });
    mockUseWorkflowsSummary.mockReturnValue({
      loading: false,
      error: null,
      hasWorkflows: false,
      latestBuild: null,
      triggeringBuild: false,
      triggerBuild: jest.fn(),
    });

    renderCard();

    expect(screen.getByTestId('forbidden-state')).toBeInTheDocument();
    expect(screen.getByText('No permission to view builds')).toBeInTheDocument();
  });

  it('shows loading skeleton when loading', () => {
    mockUseWorkflowsSummary.mockReturnValue({
      loading: true,
      error: null,
      hasWorkflows: false,
      latestBuild: null,
      triggeringBuild: false,
      triggerBuild: jest.fn(),
    });

    renderCard();

    expect(screen.getByTestId('ds-card')).toBeInTheDocument();
    expect(screen.queryByText('Workflows')).not.toBeInTheDocument();
  });

  it('shows error state when there is an error', () => {
    mockUseWorkflowsSummary.mockReturnValue({
      loading: false,
      error: new Error('fetch failed'),
      hasWorkflows: false,
      latestBuild: null,
      triggeringBuild: false,
      triggerBuild: jest.fn(),
    });

    renderCard();

    expect(screen.getByText('Failed to load workflow data')).toBeInTheDocument();
  });

  it('shows workflows not enabled state', () => {
    mockUseWorkflowsSummary.mockReturnValue({
      loading: false,
      error: null,
      hasWorkflows: false,
      latestBuild: null,
      triggeringBuild: false,
      triggerBuild: jest.fn(),
    });

    renderCard();

    expect(
      screen.getByText('Workflows not enabled for this component'),
    ).toBeInTheDocument();
  });

  it('shows no builds yet with Build Now button', () => {
    mockUseWorkflowsSummary.mockReturnValue({
      loading: false,
      error: null,
      hasWorkflows: true,
      latestBuild: null,
      triggeringBuild: false,
      triggerBuild: jest.fn(),
    });

    renderCard();

    expect(screen.getByText('No builds yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /build now/i })).toBeEnabled();
    expect(screen.getByText('View All')).toBeInTheDocument();
  });

  it('shows latest build info with status chip', () => {
    mockUseWorkflowsSummary.mockReturnValue({
      loading: false,
      error: null,
      hasWorkflows: true,
      latestBuild: {
        name: 'build-42',
        status: 'Succeeded',
        createdAt: '2024-06-01T10:00:00Z',
        commit: 'abcdef1234567890',
      },
      triggeringBuild: false,
      triggerBuild: jest.fn(),
    });

    renderCard();

    expect(screen.getByText('Latest Build')).toBeInTheDocument();
    expect(screen.getByText('build-42')).toBeInTheDocument();
    expect(screen.getByTestId('build-status-chip')).toHaveTextContent('Succeeded');
    expect(screen.getByText('relative(2024-06-01T10:00:00Z)')).toBeInTheDocument();
    expect(screen.getByText('abcdef12')).toBeInTheDocument(); // first 8 chars
  });

  it('disables Build Now when build permission denied', () => {
    mockUseBuildPermission.mockReturnValue({
      ...defaultPermission,
      canBuild: false,
    });
    mockUseWorkflowsSummary.mockReturnValue({
      loading: false,
      error: null,
      hasWorkflows: true,
      latestBuild: null,
      triggeringBuild: false,
      triggerBuild: jest.fn(),
    });

    renderCard();

    expect(screen.getByRole('button', { name: /build now/i })).toBeDisabled();
  });

  it('calls triggerBuild when Build Now is clicked', async () => {
    const user = userEvent.setup();
    const triggerBuild = jest.fn();

    mockUseWorkflowsSummary.mockReturnValue({
      loading: false,
      error: null,
      hasWorkflows: true,
      latestBuild: null,
      triggeringBuild: false,
      triggerBuild,
    });

    renderCard();

    await user.click(screen.getByRole('button', { name: /build now/i }));
    expect(triggerBuild).toHaveBeenCalled();
  });

  it('shows Building... when build is in progress', () => {
    mockUseWorkflowsSummary.mockReturnValue({
      loading: false,
      error: null,
      hasWorkflows: true,
      latestBuild: null,
      triggeringBuild: true,
      triggerBuild: jest.fn(),
    });

    renderCard();

    expect(screen.getByRole('button', { name: /building/i })).toBeDisabled();
  });
});
