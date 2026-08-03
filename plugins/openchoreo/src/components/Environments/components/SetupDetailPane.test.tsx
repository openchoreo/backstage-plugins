import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ResponseError } from '@backstage/errors';
import { TestApiProvider } from '@backstage/test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import {
  createMockOpenChoreoClient,
  mockComponentEntity,
} from '@openchoreo/test-utils';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { SetupDetailPane } from './SetupDetailPane';

// ---- Mocks ----

jest.mock('./LoadingSkeleton', () => ({
  LoadingSkeleton: ({ variant }: { variant: string }) => (
    <div data-testid={`loading-skeleton-${variant}`} />
  ),
}));

jest.mock('./DeployReleasePanel', () => ({
  DeployReleasePanel: ({
    disabled,
    onCreateRelease,
    canCreateRelease,
  }: any) => (
    <div data-testid="deploy-release-panel" data-disabled={String(!!disabled)}>
      {onCreateRelease && (
        <button
          type="button"
          onClick={onCreateRelease}
          disabled={!canCreateRelease}
        >
          Create release
        </button>
      )}
    </div>
  ),
}));

jest.mock('./ReleaseBrowserDialog', () => ({
  ReleaseBrowserDialog: ({ open, readOnly }: any) =>
    open ? (
      <div
        data-testid="release-browser-dialog"
        data-readonly={String(!!readOnly)}
      />
    ) : null,
}));

const mockUpdateAutoDeploy = jest.fn();
let updateIsUpdatingOverride = false;
jest.mock('../hooks/useAutoDeployUpdate', () => ({
  useAutoDeployUpdate: () => ({
    updateAutoDeploy: mockUpdateAutoDeploy,
    isUpdating: updateIsUpdatingOverride,
    error: null,
  }),
}));

let readinessOverride: any = null;
jest.mock('../hooks/useReleaseReadiness', () => ({
  useReleaseReadiness: () =>
    readinessOverride ?? {
      loading: false,
      canCreateRelease: true,
      alertMessage: null,
      alertSeverity: 'info',
      hasWorkload: true,
      isFromSource: false,
    },
}));

let releasesOverride: any[] = [];
jest.mock('../hooks/useReleases', () => ({
  useReleases: () => ({
    releases: releasesOverride,
    loading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

let permissionOverride: any = null;
jest.mock('@openchoreo/backstage-plugin-react', () => {
  const actual = jest.requireActual('@openchoreo/backstage-plugin-react');
  return {
    ...actual,
    useConfigureAndDeployPermission: () =>
      permissionOverride ?? {
        canConfigureAndDeploy: true,
        loading: false,
        deniedTooltip: '',
      },
  };
});

const mockShowSuccess = jest.fn();
const mockShowError = jest.fn();
jest.mock('../../../hooks', () => ({
  useNotification: () => ({
    notification: null,
    showSuccess: mockShowSuccess,
    showError: mockShowError,
    hide: jest.fn(),
  }),
}));

const mockRefetchAutoDeploy = jest.fn();
const mockRefetchEnvironments = jest.fn();
const mockBeginAwaitingNewRelease = jest.fn();
const mockSetAutoDeployOptimistic = jest.fn();
let contextOverride: Partial<{
  autoDeploy: boolean;
  autoDeployLoading: boolean;
  latestReleaseName: string | null;
  awaitingNewRelease: boolean;
  componentError: { reason?: string; message?: string } | null;
  environments: Array<Record<string, unknown>>;
  lowestEnvironment: string;
}> = {};
jest.mock('../EnvironmentsContext', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  return {
    useEnvironmentsContext: () => {
      // Stateful auto-deploy so optimistic writes flip what the context
      // returns on the next render (mirrors useAutoDeploy in production).
      const baseAutoDeploy = contextOverride.autoDeploy ?? false;
      const [autoDeploy, setAutoDeploy] = React.useState(baseAutoDeploy);
      React.useEffect(() => {
        setAutoDeploy(baseAutoDeploy);
      }, [baseAutoDeploy]);
      // Strip `autoDeploy` from the override spread — the hook above
      // owns it; the override only seeds the initial value.
      const { autoDeploy: _ignored, ...restOverride } = contextOverride;
      return {
        environments: [{ name: 'development', deployment: {}, endpoints: [] }],
        displayEnvironments: [],
        loading: false,
        refetch: mockRefetchEnvironments,
        lowestEnvironment: 'development',
        isWorkloadEditorSupported: true,
        onPendingActionComplete: jest.fn(),
        canViewEnvironments: true,
        environmentReadPermissionLoading: false,
        canViewBindings: true,
        bindingsPermissionLoading: false,
        autoDeploy,
        autoDeployLoading: false,
        refetchAutoDeploy: mockRefetchAutoDeploy,
        setAutoDeployOptimistic: (next: boolean) => {
          mockSetAutoDeployOptimistic(next);
          setAutoDeploy(next);
        },
        latestReleaseName: null,
        awaitingNewRelease: false,
        componentError: null,
        beginAwaitingNewRelease: mockBeginAwaitingNewRelease,
        selection: null,
        setSelection: jest.fn(),
        ...restOverride,
      };
    },
  };
});

// ---- Helpers ----

const mockClient = createMockOpenChoreoClient();
const testEntity = mockComponentEntity();

const renderPane = (
  props: Partial<React.ComponentProps<typeof SetupDetailPane>> = {},
) =>
  render(
    <MemoryRouter>
      <TestApiProvider apis={[[openChoreoClientApiRef, mockClient]]}>
        <EntityProvider entity={testEntity}>
          <SetupDetailPane
            environmentsExist
            isWorkloadEditorSupported
            loading={false}
            onConfigureWorkload={jest.fn()}
            onClose={jest.fn()}
            {...props}
          />
        </EntityProvider>
      </TestApiProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  readinessOverride = null;
  permissionOverride = null;
  contextOverride = {};
  releasesOverride = [];
  updateIsUpdatingOverride = false;
  mockClient.getComponentDetails.mockResolvedValue({ autoDeploy: false });
});

describe('SetupDetailPane', () => {
  it('renders the deploy panel with an inline Create release affordance', async () => {
    renderPane();

    expect(screen.getByTestId('deploy-release-panel')).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: /create release/i }),
    ).toBeEnabled();
  });

  it('Create release navigates to the workload page (onConfigureWorkload)', async () => {
    const onConfigureWorkload = jest.fn();
    const user = userEvent.setup();
    renderPane({ onConfigureWorkload });

    await user.click(
      await screen.findByRole('button', { name: /create release/i }),
    );

    expect(onConfigureWorkload).toHaveBeenCalledTimes(1);
  });

  it('disables Create release when readiness blocks it and surfaces the reason', async () => {
    readinessOverride = {
      loading: false,
      canCreateRelease: false,
      alertMessage:
        'Build your application first to generate a container image.',
      alertSeverity: 'warning',
      hasWorkload: false,
      isFromSource: true,
    };

    renderPane();

    const button = await screen.findByRole('button', {
      name: /create release/i,
    });
    expect(button).toBeDisabled();
    expect(
      screen.getByText(
        'Build your application first to generate a container image.',
      ),
    ).toBeInTheDocument();
  });

  it('flips the toggle optimistically on Confirm — dialog closes before the PATCH resolves', async () => {
    const user = userEvent.setup();
    // Deferred PATCH so we can observe state mid-flight. `updateAutoDeploy`
    // resolves to `void` upstream; we keep a resolve handle to time when
    // it lands relative to the assertions below.
    let resolvePatch: () => void = () => {};
    mockUpdateAutoDeploy.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolvePatch = resolve;
        }),
    );
    renderPane();

    await waitFor(() => {
      expect(
        screen.getByRole('checkbox', { name: /auto deploy/i }),
      ).not.toBeChecked();
    });

    await user.click(screen.getByRole('checkbox', { name: /auto deploy/i }));
    expect(screen.getByText('Enable Auto Deploy?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /confirm/i }));

    // Dialog gone, switch already in the new state, PATCH still pending.
    await waitFor(() => {
      expect(screen.queryByText('Enable Auto Deploy?')).toBeNull();
    });
    expect(
      screen.getByRole('checkbox', { name: /auto deploy/i }),
    ).toBeChecked();
    expect(mockSetAutoDeployOptimistic).toHaveBeenCalledWith(true);
    expect(mockUpdateAutoDeploy).toHaveBeenCalledWith(true);
    expect(mockShowSuccess).not.toHaveBeenCalled();
    // No card-wide skeleton during the optimistic update.
    expect(screen.queryByTestId('loading-skeleton-setup')).toBeNull();

    resolvePatch();

    await waitFor(() => {
      expect(mockShowSuccess).toHaveBeenCalledWith(
        'Auto deploy enabled successfully',
      );
    });
    // Still no skeleton after resolve — we trust the PATCH and never refetch.
    expect(screen.queryByTestId('loading-skeleton-setup')).toBeNull();
    expect(mockRefetchAutoDeploy).not.toHaveBeenCalled();
  });

  it('shows the "Saving…" hint next to the switch while the PATCH is in flight', () => {
    // Drive `isUpdating=true` directly via the hook mock — easier than
    // racing a deferred promise across renders.
    updateIsUpdatingOverride = true;
    renderPane();

    expect(screen.getByText(/Saving…/)).toBeInTheDocument();
    // The card body must remain visible — the hint is inline, not a
    // card-wide skeleton.
    expect(screen.queryByTestId('loading-skeleton-setup')).toBeNull();
  });

  it('snaps the toggle back and surfaces an error when the PATCH fails', async () => {
    const user = userEvent.setup();
    mockUpdateAutoDeploy.mockRejectedValue(new Error('boom'));
    renderPane();

    await waitFor(() => {
      expect(
        screen.getByRole('checkbox', { name: /auto deploy/i }),
      ).not.toBeChecked();
    });

    await user.click(screen.getByRole('checkbox', { name: /auto deploy/i }));
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(
        'Failed to update auto deploy setting: boom',
      );
    });
    // Optimistic flip (true), then rollback (false).
    expect(mockSetAutoDeployOptimistic).toHaveBeenNthCalledWith(1, true);
    expect(mockSetAutoDeployOptimistic).toHaveBeenNthCalledWith(2, false);
    await waitFor(() => {
      expect(
        screen.getByRole('checkbox', { name: /auto deploy/i }),
      ).not.toBeChecked();
    });
  });

  it('snaps the toggle back with a permission-specific message on 403', async () => {
    const user = userEvent.setup();
    const forbidden = await ResponseError.fromResponse(
      new Response(
        JSON.stringify({
          error: { name: 'NotAllowedError', message: 'no' },
        }),
        { status: 403, statusText: 'Forbidden' },
      ),
    );
    mockUpdateAutoDeploy.mockRejectedValue(forbidden);
    renderPane();

    await waitFor(() => {
      expect(
        screen.getByRole('checkbox', { name: /auto deploy/i }),
      ).not.toBeChecked();
    });

    await user.click(screen.getByRole('checkbox', { name: /auto deploy/i }));
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    expect(mockUpdateAutoDeploy).toHaveBeenCalledWith(true);
    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(
        'You do not have permission to change auto deploy.',
      );
    });
    expect(mockShowSuccess).not.toHaveBeenCalled();
    // Same rollback path as the generic-error test — 403 isn't special
    // for state, only for messaging.
    expect(mockSetAutoDeployOptimistic).toHaveBeenNthCalledWith(2, false);
    await waitFor(() => {
      expect(
        screen.getByRole('checkbox', { name: /auto deploy/i }),
      ).not.toBeChecked();
    });
  });

  it('hides the deploy panel and shows Configure & deploy when auto-deploy is on', async () => {
    contextOverride = { autoDeploy: true };
    renderPane();

    expect(
      await screen.findByRole('button', { name: /configure & deploy/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /create release/i }),
    ).toBeNull();
    expect(screen.queryByTestId('deploy-release-panel')).toBeNull();
  });

  it('surfaces a controller auto-deploy failure inline when auto-deploy is on', async () => {
    contextOverride = {
      autoDeploy: true,
      componentError: {
        reason: 'AutoDeployFailed',
        message: "Failed to handle autoDeploy: trait 'auth' not found",
      },
    };
    renderPane();

    expect(
      await screen.findByText(/Failed to handle autoDeploy/),
    ).toBeInTheDocument();
    expect(screen.getByText(/AutoDeployFailed/)).toBeInTheDocument();
  });

  it('hides the controller failure while still awaiting the new release', async () => {
    contextOverride = {
      autoDeploy: true,
      awaitingNewRelease: true,
      componentError: {
        reason: 'AutoDeployFailed',
        message: "Failed to handle autoDeploy: trait 'auth' not found",
      },
    };
    renderPane();

    // While the post-save poll is still running we don't flash a stale error.
    await screen.findByRole('button', { name: /configure & deploy/i });
    expect(screen.queryByText(/Failed to handle autoDeploy/)).toBeNull();
  });

  it('shows the controller-managed latest release, not the newest orphan CR', async () => {
    // Simulates the orphan-release scenario: an unbound CR is newest by
    // creationTimestamp, but status.latestRelease points at the actually-
    // bound release. The row must render the bound one.
    contextOverride = {
      autoDeploy: true,
      latestReleaseName: 'snip-redis-bound',
    };
    releasesOverride = [
      {
        metadata: {
          name: 'snip-redis-orphan-newest',
          creationTimestamp: '2026-05-28T08:00:00Z',
        },
        spec: { workload: { container: { image: 'redis:7-alpine' } } },
      },
      {
        metadata: {
          name: 'snip-redis-bound',
          creationTimestamp: '2026-05-28T07:00:00Z',
        },
        spec: { workload: { container: { image: 'redis:7-alpine' } } },
      },
    ];
    renderPane();

    expect(await screen.findByText('snip-redis-bound')).toBeInTheDocument();
    expect(screen.queryByText('snip-redis-orphan-newest')).toBeNull();
  });

  it('shows the empty state when status.latestRelease is absent', async () => {
    // Even if newest-by-timestamp releases exist, an absent status pointer
    // means the controller hasn't blessed any release yet — render the
    // empty-state copy rather than falling back to releases[0].
    contextOverride = { autoDeploy: true, latestReleaseName: null };
    releasesOverride = [
      {
        metadata: {
          name: 'snip-redis-anything',
          creationTimestamp: '2026-05-28T08:00:00Z',
        },
        spec: { workload: { container: { image: 'redis:7-alpine' } } },
      },
    ];
    renderPane();

    expect(await screen.findByText(/no release yet/i)).toBeInTheDocument();
    expect(screen.queryByText('snip-redis-anything')).toBeNull();
  });

  it('shows the "Deploying…" pill next to the current release while awaiting', async () => {
    contextOverride = {
      autoDeploy: true,
      latestReleaseName: 'snip-redis-prev',
      awaitingNewRelease: true,
    };
    releasesOverride = [
      {
        metadata: {
          name: 'snip-redis-prev',
          creationTimestamp: '2026-05-28T07:00:00Z',
        },
        spec: { workload: { container: { image: 'redis:7-alpine' } } },
      },
    ];
    renderPane();

    // Both the previous release name and the "Deploying…" pill render
    // simultaneously so the user sees what's being replaced.
    expect(await screen.findByText('snip-redis-prev')).toBeInTheDocument();
    expect(screen.getByText(/Deploying…/)).toBeInTheDocument();
    // The empty-state copy must not appear while the pill is showing.
    expect(screen.queryByText(/no release yet/i)).toBeNull();
  });

  it('shows the "Deploying…" pill alone when no prior release exists', async () => {
    // First-ever save under auto-deploy: status hasn't been populated yet
    // but the user just hit Save & deploy. Pill renders without a name;
    // empty-state copy stays hidden.
    contextOverride = {
      autoDeploy: true,
      latestReleaseName: null,
      awaitingNewRelease: true,
    };
    renderPane();

    expect(await screen.findByText(/Deploying…/)).toBeInTheDocument();
    expect(screen.queryByText(/no release yet/i)).toBeNull();
  });

  it('refresh button refetches both Component status and env list', async () => {
    const user = userEvent.setup();
    renderPane();

    await user.click(screen.getByRole('button', { name: /^refresh$/i }));

    expect(mockRefetchAutoDeploy).toHaveBeenCalledTimes(1);
    expect(mockRefetchEnvironments).toHaveBeenCalledTimes(1);
  });

  it('renders the setup skeleton while auto-deploy is loading', () => {
    contextOverride = { autoDeployLoading: true };
    renderPane();

    expect(screen.getByTestId('loading-skeleton-setup')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /create release/i }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: /configure component/i }),
    ).toBeNull();
  });

  it('disables actions when the user lacks the deploy permission', async () => {
    permissionOverride = {
      canConfigureAndDeploy: false,
      loading: false,
      deniedTooltip: 'You do not have permission to deploy.',
    };

    renderPane();

    expect(
      await screen.findByRole('button', { name: /create release/i }),
    ).toBeDisabled();
    expect(screen.getByTestId('deploy-release-panel')).toHaveAttribute(
      'data-disabled',
      'true',
    );
  });

  describe('project-not-deployed block (S1)', () => {
    it('disables Deploy and shows the callout when the project is not deployed in the first env', () => {
      // Display name is capitalised while lowestEnvironment is lowercased —
      // the block must still match (regression guard for the casing bug).
      contextOverride = {
        environments: [
          {
            name: 'Development',
            resourceName: 'development',
            projectDeploymentStatus: 'not-deployed',
            deployment: {},
            endpoints: [],
          },
        ],
        lowestEnvironment: 'development',
      };

      renderPane();

      expect(screen.getByTestId('deploy-release-panel')).toHaveAttribute(
        'data-disabled',
        'true',
      );
      expect(screen.getByText('Project not deployed')).toBeInTheDocument();
    });

    it('keeps Deploy enabled and shows an info line when the project deployment is pending', () => {
      contextOverride = {
        environments: [
          {
            name: 'Development',
            resourceName: 'development',
            projectDeploymentStatus: 'pending',
            deployment: {},
            endpoints: [],
          },
        ],
        lowestEnvironment: 'development',
      };

      renderPane();

      expect(screen.getByTestId('deploy-release-panel')).toHaveAttribute(
        'data-disabled',
        'false',
      );
      expect(
        screen.queryByText('Project not deployed'),
      ).not.toBeInTheDocument();
      expect(screen.getByText(/still in progress/i)).toBeInTheDocument();
    });

    it('does not block when the project is deployed (ready)', () => {
      contextOverride = {
        environments: [
          {
            name: 'Development',
            resourceName: 'development',
            projectDeploymentStatus: 'ready',
            deployment: {},
            endpoints: [],
          },
        ],
        lowestEnvironment: 'development',
      };

      renderPane();

      expect(screen.getByTestId('deploy-release-panel')).toHaveAttribute(
        'data-disabled',
        'false',
      );
      expect(
        screen.queryByText('Project not deployed'),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/still in progress/i)).not.toBeInTheDocument();
    });
  });
});
