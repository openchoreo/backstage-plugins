import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProjectMiniEnvironmentNode } from './ProjectMiniEnvironmentNode';
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

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdatePerm.mockReturnValue({
    canUpdate: true,
    loading: false,
    updateDeniedTooltip: '',
  });
});

function bound(): ProjectEnvironment {
  return {
    name: 'dev',
    resourceName: 'development',
    bindingName: 'my-app-development',
    projectRelease: 'my-app-abc',
    status: 'Ready',
    latestRelease: 'my-app-abc',
    lastDeployed: '2026-01-01T00:00:00Z',
  };
}

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

function renderTile(
  env: ProjectEnvironment,
  selected = false,
  onSelect: () => void = () => {},
  ctxOverrides: Partial<ProjectEnvironmentsContextValue> = {},
) {
  return render(
    <MemoryRouter>
      <ProjectEnvironmentsProvider value={makeCtx(ctxOverrides)}>
        <ProjectMiniEnvironmentNode
          env={env}
          selected={selected}
          onSelect={onSelect}
        />
      </ProjectEnvironmentsProvider>
    </MemoryRouter>,
  );
}

describe('ProjectMiniEnvironmentNode', () => {
  it('renders env name + active badge + deployed timestamp for a bound env', () => {
    renderTile(bound());

    expect(screen.getByText('dev')).toBeInTheDocument();
    expect(screen.getByTestId('status-badge').textContent).toBe('active');
    expect(screen.getByText(/deployed/i)).toBeInTheDocument();
    expect(screen.getByText('just now')).toBeInTheDocument();
  });

  it('shows the not-deployed badge and omits timestamp when no binding', () => {
    renderTile({ name: 'staging' });
    expect(screen.getByTestId('status-badge').textContent).toBe('not-deployed');
    expect(screen.queryByText(/deployed:/i)).toBeNull();
  });

  it('calls onSelect when the tile body is clicked and on Enter/Space', () => {
    const onSelect = jest.fn();
    renderTile(bound(), false, onSelect);
    const tile = screen.getByRole('button', {
      name: /select environment dev/i,
    });
    fireEvent.click(tile);
    fireEvent.keyDown(tile, { key: 'Enter' });
    fireEvent.keyDown(tile, { key: ' ' });
    expect(onSelect).toHaveBeenCalledTimes(3);
  });

  it('marks itself aria-pressed when selected', () => {
    renderTile(bound(), true);
    expect(
      screen.getByRole('button', { name: /select environment dev/i }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  describe('actions menu', () => {
    it('opens the menu and invokes refetch from Refresh', () => {
      const refetch = jest.fn();
      const onSelect = jest.fn();
      renderTile(bound(), false, onSelect, { refetch });

      fireEvent.click(screen.getByRole('button', { name: /actions for dev/i }));
      expect(
        screen.getByRole('menuitem', { name: /refresh/i }),
      ).toBeInTheDocument();
      // Opening the menu must not select the tile.
      expect(onSelect).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('menuitem', { name: /refresh/i }));
      expect(refetch).toHaveBeenCalled();
    });

    it('navigates to the overrides wizard from Configure overrides', () => {
      renderTile(bound());
      fireEvent.click(screen.getByRole('button', { name: /actions for dev/i }));
      fireEvent.click(
        screen.getByRole('menuitem', { name: /configure overrides/i }),
      );
      expect(mockNavigate).toHaveBeenCalledWith('overrides/development');
    });

    it('disables Configure overrides when there is no binding', () => {
      renderTile({ name: 'staging' });
      fireEvent.click(
        screen.getByRole('button', { name: /actions for staging/i }),
      );
      expect(
        screen.getByRole('menuitem', { name: /configure overrides/i }),
      ).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('inline promote action', () => {
    const env: ProjectEnvironment = {
      ...bound(),
      promotionTargets: [{ name: 'Staging', resourceName: 'staging' }],
    };
    const stagingBehind: ProjectEnvironment = {
      name: 'Staging',
      resourceName: 'staging',
      projectRelease: 'my-app-old',
      status: 'NotReady',
    };
    const stagingInSync: ProjectEnvironment = {
      name: 'Staging',
      resourceName: 'staging',
      projectRelease: 'my-app-abc',
      status: 'Ready',
    };

    it('shows Promote when the next env is behind this env release', () => {
      renderTile(env, false, () => {}, { environments: [env, stagingBehind] });
      expect(
        screen.getByRole('button', { name: /promote dev to staging/i }),
      ).toBeInTheDocument();
    });

    it('shows a disabled Promoted button when the next env is in sync', () => {
      renderTile(env, false, () => {}, { environments: [env, stagingInSync] });
      const button = screen.getByRole('button', { name: /^promoted$/i });
      expect(button).toBeInTheDocument();
      expect(button).toBeDisabled();
    });

    it('calls onPromote with the target resource name and this env release', () => {
      const onPromote = jest.fn();
      renderTile(env, false, () => {}, {
        environments: [env, stagingBehind],
        onPromote,
      });
      fireEvent.click(
        screen.getByRole('button', { name: /promote dev to staging/i }),
      );
      expect(onPromote).toHaveBeenCalledWith('staging', 'my-app-abc');
    });

    it('disables Promote when the user lacks project-update permission', () => {
      mockUpdatePerm.mockReturnValue({
        canUpdate: false,
        loading: false,
        updateDeniedTooltip: 'nope',
      });
      renderTile(env, false, () => {}, { environments: [env, stagingBehind] });
      expect(
        screen.getByRole('button', { name: /promote dev to staging/i }),
      ).toBeDisabled();
    });
  });

  describe('multi-target promote menu', () => {
    const env: ProjectEnvironment = {
      ...bound(),
      promotionTargets: [
        { name: 'Staging', resourceName: 'staging' },
        { name: 'QA', resourceName: 'qa' },
      ],
    };
    const others: ProjectEnvironment[] = [
      { name: 'Staging', resourceName: 'staging', projectRelease: 'old' },
      { name: 'QA', resourceName: 'qa', projectRelease: 'old' },
    ];

    it('opens a per-target menu and promotes the chosen target', () => {
      const onPromote = jest.fn();
      renderTile(env, false, () => {}, {
        environments: [env, ...others],
        onPromote,
      });

      fireEvent.click(screen.getByRole('button', { name: /^promote dev$/i }));
      fireEvent.click(screen.getByRole('menuitem', { name: /promote to qa/i }));
      expect(onPromote).toHaveBeenCalledWith('qa', 'my-app-abc');
    });
  });
});
