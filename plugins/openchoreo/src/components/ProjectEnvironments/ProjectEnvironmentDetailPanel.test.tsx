import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProjectEnvironmentDetailPanel } from './ProjectEnvironmentDetailPanel';
import {
  ProjectEnvironmentsProvider,
  type ProjectEnvironmentsContextValue,
} from './ProjectEnvironmentsContext';
import type { ProjectEnvironment } from '../../api/OpenChoreoClientApi';

jest.mock('@openchoreo/backstage-design-system', () => ({
  StatusBadge: ({ status }: any) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

const mockUpdatePerm = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  formatRelativeTime: () => 'just now',
  useProjectUpdatePermission: () => mockUpdatePerm(),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

function makeCtx(
  overrides: Partial<ProjectEnvironmentsContextValue> = {},
): ProjectEnvironmentsContextValue {
  return {
    environments: [],
    loading: false,
    refetch: jest.fn(),
    selectedEnvName: null,
    setSelectedEnvName: jest.fn(),
    pendingAction: null,
    onPromote: jest.fn(),
    ...overrides,
  };
}

function renderPanel(
  env: ProjectEnvironment | null,
  ctxOverrides: Partial<ProjectEnvironmentsContextValue> = {},
) {
  return render(
    <MemoryRouter>
      <ProjectEnvironmentsProvider value={makeCtx(ctxOverrides)}>
        <ProjectEnvironmentDetailPanel env={env} onClose={() => {}} />
      </ProjectEnvironmentsProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdatePerm.mockReturnValue({
    canUpdate: true,
    loading: false,
    updateDeniedTooltip: '',
  });
});

describe('ProjectEnvironmentDetailPanel', () => {
  it('shows a hint when no env is selected', () => {
    renderPanel(null);
    expect(
      screen.getByText(/select an environment to view details/i),
    ).toBeInTheDocument();
  });

  it('renders the no-binding message for an unbound env without actions', () => {
    renderPanel({ name: 'staging', latestRelease: 'rel-1' });

    expect(screen.getByText('staging')).toBeInTheDocument();
    expect(
      screen.getByText(/no binding in this environment yet/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /configure overrides/i }),
    ).toBeNull();
  });

  it('renders release meta and Configure overrides for a bound env', () => {
    renderPanel({
      name: 'dev',
      resourceName: 'development',
      bindingName: 'my-app-development',
      projectRelease: 'my-app-abc',
      status: 'Ready',
      latestRelease: 'my-app-abc',
    });

    expect(screen.getByText('Release')).toBeInTheDocument();
    expect(screen.getByText('my-app-abc')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();

    // Configure overrides navigates to the per-env wizard using the env's
    // K8s resource name.
    fireEvent.click(
      screen.getByRole('button', { name: /configure overrides/i }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('overrides/development');
  });

  it('URL-encodes the env segment when falling back to the display name', () => {
    renderPanel({
      name: 'My Env',
      bindingName: 'my-app-my-env',
      projectRelease: 'my-app-abc',
      status: 'Ready',
    });

    fireEvent.click(
      screen.getByRole('button', { name: /configure overrides/i }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('overrides/My%20Env');
  });

  it('promotes this env release to the eligible target', () => {
    const onPromote = jest.fn();
    const dev: ProjectEnvironment = {
      name: 'dev',
      resourceName: 'development',
      bindingName: 'my-app-development',
      projectRelease: 'my-app-abc',
      status: 'Ready',
      promotionTargets: [{ name: 'Staging', resourceName: 'staging' }],
    };
    const staging: ProjectEnvironment = {
      name: 'Staging',
      resourceName: 'staging',
      bindingName: 'my-app-staging',
      projectRelease: 'my-app-old',
      status: 'Ready',
    };

    renderPanel(dev, { environments: [dev, staging], onPromote });

    fireEvent.click(screen.getByRole('button', { name: /^promote$/i }));
    // Promote pins the target env (by K8s resource name) to this env's release.
    expect(onPromote).toHaveBeenCalledWith('staging', 'my-app-abc');
  });

  it('disables Configure overrides when the user lacks project-update permission', () => {
    mockUpdatePerm.mockReturnValue({
      canUpdate: false,
      loading: false,
      updateDeniedTooltip: 'nope',
    });
    renderPanel({
      name: 'dev',
      resourceName: 'development',
      bindingName: 'my-app-development',
      projectRelease: 'my-app-abc',
      status: 'Ready',
    });

    expect(
      screen.getByRole('button', { name: /configure overrides/i }),
    ).toBeDisabled();
  });
});
