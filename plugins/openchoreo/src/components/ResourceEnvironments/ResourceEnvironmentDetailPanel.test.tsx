import { render, screen, fireEvent } from '@testing-library/react';
import { ResourceEnvironmentDetailPanel } from './ResourceEnvironmentDetailPanel';
import {
  ResourceEnvironmentsProvider,
  type ResourceEnvironmentsContextValue,
} from './ResourceEnvironmentsContext';
import type { ResourceEnvironment } from '../../api/OpenChoreoClientApi';

jest.mock('@openchoreo/backstage-design-system', () => ({
  StatusBadge: ({ status }: any) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

const mockUpdatePerm = jest.fn();
const mockCreatePerm = jest.fn();
const mockDeletePerm = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useResourceReleaseBindingUpdatePermission: () => mockUpdatePerm(),
  useResourceReleaseBindingCreatePermission: () => mockCreatePerm(),
  useResourceReleaseBindingDeletePermission: () => mockDeletePerm(),
}));

function makeCtx(
  overrides: Partial<ResourceEnvironmentsContextValue> = {},
): ResourceEnvironmentsContextValue {
  return {
    environments: [],
    loading: false,
    refetch: jest.fn(),
    selectedEnvName: null,
    setSelectedEnvName: jest.fn(),
    pendingAction: null,
    onPromote: jest.fn(),
    onDeploy: jest.fn(),
    onUndeployRequest: jest.fn(),
    onRetainPolicyChange: jest.fn(),
    ...overrides,
  };
}

function renderPanel(
  env: ResourceEnvironment | null,
  ctxOverrides: Partial<ResourceEnvironmentsContextValue> = {},
) {
  return render(
    <ResourceEnvironmentsProvider value={makeCtx(ctxOverrides)}>
      <ResourceEnvironmentDetailPanel env={env} onClose={() => {}} />
    </ResourceEnvironmentsProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdatePerm.mockReturnValue({
    canUpdate: true,
    loading: false,
    deniedTooltip: '',
  });
  mockCreatePerm.mockReturnValue({
    canCreate: true,
    loading: false,
    deniedTooltip: '',
  });
  mockDeletePerm.mockReturnValue({
    canDelete: true,
    loading: false,
    deniedTooltip: '',
  });
});

describe('ResourceEnvironmentDetailPanel', () => {
  it('shows a hint when no env is selected', () => {
    renderPanel(null);
    expect(
      screen.getByText(/select an environment from the pipeline/i),
    ).toBeInTheDocument();
  });

  it('renders empty body + Deploy button for unbound env with latestRelease', () => {
    const onDeploy = jest.fn();
    renderPanel({ name: 'staging', latestRelease: 'rel-1' }, { onDeploy });

    expect(screen.getByText('staging')).toBeInTheDocument();
    expect(
      screen.getByText(/no binding in this environment yet/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^deploy$/i })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /^deploy$/i }));
    expect(onDeploy).toHaveBeenCalledWith('staging', 'rel-1');
  });

  it('omits Deploy button when there is no latestRelease', () => {
    renderPanel({ name: 'staging' });
    expect(screen.queryByRole('button', { name: /^deploy$/i })).toBeNull();
  });

  it('renders full meta + Undeploy for a bound env', () => {
    const onUndeployRequest = jest.fn();
    renderPanel(
      {
        name: 'dev',
        bindingName: 'b-dev',
        resourceRelease: 'rel-abc',
        retainPolicy: 'Delete',
        status: 'Ready',
        latestRelease: 'rel-abc',
      },
      { onUndeployRequest },
    );

    expect(screen.getByText('Release')).toBeInTheDocument();
    expect(screen.getByText('rel-abc')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^promote$/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^undeploy$/i }));
    expect(onUndeployRequest).toHaveBeenCalledWith('dev');
  });

  it('shows Promote when binding pin is behind latestRelease', () => {
    const onPromote = jest.fn();
    renderPanel(
      {
        name: 'dev',
        bindingName: 'b-dev',
        resourceRelease: 'rel-old',
        retainPolicy: 'Delete',
        status: 'Ready',
        latestRelease: 'rel-new',
      },
      { onPromote },
    );

    fireEvent.click(screen.getByRole('button', { name: /^promote$/i }));
    expect(onPromote).toHaveBeenCalledWith('dev', 'rel-new');
  });

  it('renders an interactive retainPolicy toggle for users with update permission', () => {
    const onRetainPolicyChange = jest.fn();
    renderPanel(
      {
        name: 'dev',
        bindingName: 'b-dev',
        resourceRelease: 'rel-1',
        retainPolicy: 'Delete',
        status: 'Ready',
        latestRelease: 'rel-1',
      },
      { onRetainPolicyChange },
    );

    fireEvent.click(screen.getByRole('button', { name: /^retain$/i }));
    expect(onRetainPolicyChange).toHaveBeenCalledWith('dev', 'Retain');
  });

  it('renders retainPolicy as plain text when user lacks update permission', () => {
    mockUpdatePerm.mockReturnValue({
      canUpdate: false,
      loading: false,
      deniedTooltip: 'no perm',
    });
    renderPanel({
      name: 'dev',
      bindingName: 'b-dev',
      resourceRelease: 'rel-1',
      retainPolicy: 'Delete',
      status: 'Ready',
      latestRelease: 'rel-1',
    });

    expect(screen.queryByRole('group', { name: /retain policy/i })).toBeNull();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('renders outputs section when outputs are present', () => {
    renderPanel({
      name: 'dev',
      bindingName: 'b-dev',
      resourceRelease: 'rel-1',
      status: 'Ready',
      latestRelease: 'rel-1',
      outputs: [{ name: 'host', value: 'db.dev.svc' }],
    });
    expect(screen.getByText('Outputs')).toBeInTheDocument();
    expect(screen.getByText('host')).toBeInTheDocument();
    expect(screen.getByText('db.dev.svc')).toBeInTheDocument();
  });

  it('disables Promote when isPromoting for this env', () => {
    renderPanel(
      {
        name: 'dev',
        bindingName: 'b-dev',
        resourceRelease: 'rel-old',
        status: 'Ready',
        latestRelease: 'rel-new',
      },
      { pendingAction: { env: 'dev', kind: 'promote' } },
    );
    expect(screen.getByRole('button', { name: /^promote$/i })).toBeDisabled();
  });

  describe('drift badge', () => {
    it('renders a "Behind" badge inline with the Release row when behind latest', () => {
      renderPanel({
        name: 'dev',
        bindingName: 'b-dev',
        resourceRelease: 'rel-old',
        retainPolicy: 'Delete',
        status: 'Ready',
        latestRelease: 'rel-new',
      });
      expect(screen.getByText('Behind')).toBeInTheDocument();
    });

    it('does not render the badge when at latest', () => {
      renderPanel({
        name: 'dev',
        bindingName: 'b-dev',
        resourceRelease: 'rel-1',
        retainPolicy: 'Delete',
        status: 'Ready',
        latestRelease: 'rel-1',
      });
      expect(screen.queryByText('Behind')).toBeNull();
    });
  });
});
