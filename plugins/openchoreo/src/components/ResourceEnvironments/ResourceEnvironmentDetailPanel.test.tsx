import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
const mockDeletePerm = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useResourceReleaseBindingUpdatePermission: () => mockUpdatePerm(),
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
    driftByEnv: new Map(),
    onPromote: jest.fn(),
    onUndeployRequest: jest.fn(),
    onRetainPolicyChange: jest.fn(),
    onViewReleaseManifest: jest.fn(),
    ...overrides,
  };
}

function renderPanel(
  env: ResourceEnvironment | null,
  ctxOverrides: Partial<ResourceEnvironmentsContextValue> = {},
) {
  // The panel uses useNavigate for the Configure overrides button, so it
  // needs a router context. MemoryRouter keeps each test isolated.
  return render(
    <MemoryRouter>
      <ResourceEnvironmentsProvider value={makeCtx(ctxOverrides)}>
        <ResourceEnvironmentDetailPanel env={env} onClose={() => {}} />
      </ResourceEnvironmentsProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdatePerm.mockReturnValue({
    canUpdate: true,
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
      screen.getByText(/select an environment to view details/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/set up/i)).toBeInTheDocument();
  });

  it('renders the empty-state message for an unbound env with no actions', () => {
    renderPanel({ name: 'staging', latestRelease: 'rel-1' });

    expect(screen.getByText('staging')).toBeInTheDocument();
    expect(
      screen.getByText(/no binding in this environment yet/i),
    ).toBeInTheDocument();
    // First-deploy is exclusively via the Set up flow on the canvas.
    expect(screen.queryByRole('button', { name: /^deploy$/i })).toBeNull();
    // Actions / Configure overrides only render once a binding exists.
    expect(
      screen.queryByRole('button', { name: /configure overrides/i }),
    ).toBeNull();
  });

  it('renders full meta and exposes Remove deployment via the Danger zone', () => {
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
    // The destructive surface lives in the Danger zone now, not the Actions row.
    expect(screen.queryByRole('button', { name: /^undeploy$/i })).toBeNull();

    // Expand the Danger zone, then click Remove deployment.
    fireEvent.click(screen.getByLabelText('Danger zone'));
    fireEvent.click(
      screen.getByRole('button', { name: /^remove deployment$/i }),
    );
    expect(onUndeployRequest).toHaveBeenCalledWith('dev');
  });

  it('shows Promote to <next-env> when a promotion target is eligible', () => {
    const onPromote = jest.fn();
    const dev = {
      name: 'dev',
      bindingName: 'b-dev',
      resourceRelease: 'rel-abc',
      retainPolicy: 'Delete' as const,
      status: 'Ready' as const,
      promotionTargets: [{ name: 'staging' }],
    };
    const staging = {
      name: 'staging',
      resourceName: 'staging',
      // Staging exists but lacks rel-abc, so dev can promote forward.
    };
    renderPanel(dev, {
      onPromote,
      environments: [dev, staging],
    });

    fireEvent.click(screen.getByRole('button', { name: /^promote$/i }));
    expect(onPromote).toHaveBeenCalledWith('staging', 'rel-abc');
  });

  it('opens the release manifest dialog via the Release row View button', () => {
    const onViewReleaseManifest = jest.fn();
    const env = {
      name: 'dev',
      bindingName: 'b-dev',
      resourceRelease: 'rel-1',
      retainPolicy: 'Delete' as const,
      status: 'Ready' as const,
      latestRelease: 'rel-1',
    };
    renderPanel(env, { onViewReleaseManifest });

    fireEvent.click(
      screen.getByRole('button', { name: /view release manifest/i }),
    );
    expect(onViewReleaseManifest).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'dev', resourceRelease: 'rel-1' }),
    );
  });

  it('lets Delete-policy users flip to Retain without a confirm dialog', () => {
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

    fireEvent.click(screen.getByLabelText('Danger zone'));
    fireEvent.click(screen.getByRole('button', { name: /^retain$/i }));
    // Delete → Retain only adds safety, so no confirm dialog.
    expect(screen.queryByText(/switch retain policy to delete/i)).toBeNull();
    expect(onRetainPolicyChange).toHaveBeenCalledWith('dev', 'Retain');
  });

  it('intercepts Retain → Delete with a confirm dialog before applying', () => {
    const onRetainPolicyChange = jest.fn();
    renderPanel(
      {
        name: 'dev',
        bindingName: 'b-dev',
        resourceRelease: 'rel-1',
        retainPolicy: 'Retain',
        status: 'Ready',
        latestRelease: 'rel-1',
      },
      { onRetainPolicyChange },
    );

    fireEvent.click(screen.getByLabelText('Danger zone'));
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    // Switch fires the confirm dialog, not the underlying change.
    expect(onRetainPolicyChange).not.toHaveBeenCalled();
    expect(
      screen.getByText(/switch retain policy to delete/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^set to delete$/i }));
    expect(onRetainPolicyChange).toHaveBeenCalledWith('dev', 'Delete');
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

    fireEvent.click(screen.getByLabelText('Danger zone'));
    expect(screen.queryByRole('group', { name: /retain policy/i })).toBeNull();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('disables Remove deployment when retainPolicy is Retain', () => {
    renderPanel({
      name: 'dev',
      bindingName: 'b-dev',
      resourceRelease: 'rel-1',
      retainPolicy: 'Retain',
      status: 'Ready',
      latestRelease: 'rel-1',
    });

    fireEvent.click(screen.getByLabelText('Danger zone'));
    expect(
      screen.getByRole('button', { name: /^remove deployment$/i }),
    ).toBeDisabled();
  });

  it('keeps the Danger zone collapsed by default and hidden when no binding', () => {
    // No-binding env: danger zone never renders.
    renderPanel({ name: 'staging', latestRelease: 'rel-1' });
    expect(screen.queryByLabelText('Danger zone')).toBeNull();
  });

  it('renders an Outputs section with the count and View All link', () => {
    renderPanel({
      name: 'dev',
      bindingName: 'b-dev',
      resourceRelease: 'rel-1',
      status: 'Ready',
      latestRelease: 'rel-1',
      outputs: [
        { name: 'host', value: 'db.dev.svc' },
        { name: 'port', value: '5432' },
      ],
    });
    expect(screen.getByText('Outputs (2)')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /view all/i }),
    ).toBeInTheDocument();
    // Output values are not inline — they live in the modal that View All opens.
    expect(screen.queryByText('host')).toBeNull();
    expect(screen.queryByText('db.dev.svc')).toBeNull();
  });

  it('opens the outputs dialog when View All is clicked', () => {
    renderPanel({
      name: 'dev',
      bindingName: 'b-dev',
      resourceRelease: 'rel-1',
      status: 'Ready',
      latestRelease: 'rel-1',
      outputs: [{ name: 'host', value: 'db.dev.svc' }],
    });

    fireEvent.click(screen.getByRole('button', { name: /view all/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/outputs — dev/i)).toBeInTheDocument();
    expect(screen.getByText('host')).toBeInTheDocument();
    expect(screen.getByText('db.dev.svc')).toBeInTheDocument();
  });

  it('hides the Outputs section when there are no outputs', () => {
    renderPanel({
      name: 'dev',
      bindingName: 'b-dev',
      resourceRelease: 'rel-1',
      status: 'Ready',
      latestRelease: 'rel-1',
    });
    expect(screen.queryByText(/outputs \(/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /view all/i })).toBeNull();
  });

  it('shows Promoting... while a forward promote is in flight', () => {
    const dev = {
      name: 'dev',
      bindingName: 'b-dev',
      resourceRelease: 'rel-abc',
      retainPolicy: 'Delete' as const,
      status: 'Ready' as const,
      promotionTargets: [{ name: 'staging' }],
    };
    renderPanel(dev, {
      environments: [dev, { name: 'staging', resourceName: 'staging' }],
      pendingAction: { env: 'staging', kind: 'promote' },
    });
    expect(screen.getByText('Promoting...')).toBeInTheDocument();
  });
});
