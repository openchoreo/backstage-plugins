import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  EnvironmentDetailPanel,
  type EnvironmentDetailPanelProps,
} from './EnvironmentDetailPanel';
import type { Environment, ItemActionTracker } from '../types';

jest.mock('@openchoreo/backstage-plugin-react', () => ({
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
  formatRelativeTime: (s: string) => `relative-${s}`,
}));

jest.mock('@openchoreo/backstage-design-system', () => ({
  StatusBadge: (props: { status: string }) => (
    <span data-testid="status-badge">{props.status}</span>
  ),
}));

jest.mock('./SetupDetailPane', () => ({
  SetupDetailPane: (props: { onClose: () => void }) => (
    <div data-testid="setup-detail-pane">
      <button type="button" onClick={props.onClose}>
        close-setup
      </button>
    </div>
  ),
}));

// ReleaseManifestDialog uses useApi/useEntity which need provider context
// these tests don't supply. The dialog has its own focused test file.
jest.mock('./ReleaseManifestDialog', () => ({
  ReleaseManifestDialog: () => null,
}));

jest.mock('./ComponentReleaseDiffDialog', () => ({
  ComponentReleaseDiffDialog: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" data-testid="diff-dialog" /> : null,
}));

function tracker(): ItemActionTracker {
  return {
    isActive: () => false,
    withTracking: async (_id: string, fn: () => Promise<any>) => fn(),
    activeItems: new Set<string>(),
    startAction: jest.fn(),
    endAction: jest.fn(),
  } as unknown as ItemActionTracker;
}

function makeEnv(
  overrides: Partial<Environment> & { name: string },
): Environment {
  return {
    name: overrides.name,
    deployment: overrides.deployment ?? { status: 'Ready' },
    endpoints: overrides.endpoints ?? [],
    promotionTargets: overrides.promotionTargets,
    bindingName: overrides.bindingName,
  };
}

function renderPanel(overrides: Partial<EnvironmentDetailPanelProps> = {}) {
  const props: EnvironmentDetailPanelProps = {
    selection: null,
    isAlreadyPromoted: () => false,
    actionTrackers: { promotionTracker: tracker(), suspendTracker: tracker() },
    hasAnyDeployedEnv: false,
    isWorkloadEditorSupported: true,
    environmentsExist: true,
    loadingSetup: false,
    onConfigureWorkload: jest.fn(),
    onClose: jest.fn(),
    onRefresh: jest.fn(),
    onOpenOverrides: jest.fn(),
    onOpenReleaseDetails: jest.fn(),
    onPromote: jest.fn().mockResolvedValue(undefined),
    onSuspend: jest.fn().mockResolvedValue(undefined),
    onRedeploy: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return { ...render(<EnvironmentDetailPanel {...props} />), props };
}

describe('EnvironmentDetailPanel', () => {
  it('shows the "get started" empty state when nothing is deployed yet', () => {
    renderPanel({ selection: null, hasAnyDeployedEnv: false });
    expect(
      screen.getByText(/configure & deploy your component to get started/i),
    ).toBeInTheDocument();
  });

  it('shows the "select env or update setup" empty state when something is deployed', () => {
    renderPanel({ selection: null, hasAnyDeployedEnv: true });
    expect(
      screen.getByText(/select an environment to view details/i),
    ).toBeInTheDocument();
  });

  it('renders SetupDetailPane when selection is setup', () => {
    renderPanel({ selection: { kind: 'setup' } });
    expect(screen.getByTestId('setup-detail-pane')).toBeInTheDocument();
  });

  it('renders the env name and status badge for an env selection', () => {
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'production',
          deployment: { status: 'Ready' },
        }),
      },
    });
    expect(screen.getByText('production')).toBeInTheDocument();
    const badges = screen.getAllByTestId('status-badge');
    expect(badges[0]).toHaveTextContent('active');
  });

  it('fires onClose when the close button on the env panel is clicked', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel({
      selection: { kind: 'env', environment: makeEnv({ name: 'staging' }) },
    });
    await user.click(screen.getByLabelText('Close detail panel'));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('fires onRefresh from the env panel chrome', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel({
      selection: { kind: 'env', environment: makeEnv({ name: 'staging' }) },
    });
    await user.click(screen.getByLabelText('Refresh environment'));
    expect(props.onRefresh).toHaveBeenCalled();
  });

  it('fires onOpenOverrides from the prominent Configure overrides button', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          bindingName: 'staging-binding',
        }),
      },
    });
    await user.click(
      screen.getByRole('button', { name: /configure overrides/i }),
    );
    expect(props.onOpenOverrides).toHaveBeenCalled();
  });

  it('disables Configure overrides when the env has no binding (not deployed)', () => {
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          // no bindingName ⇒ never deployed
        }),
      },
    });
    expect(
      screen.getByRole('button', { name: /configure overrides/i }),
    ).toBeDisabled();
  });

  it('hides the danger zone (and Remove deployment) by default', () => {
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          bindingName: 'staging-binding',
        }),
      },
      onRemoveDeployment: jest.fn().mockResolvedValue(undefined),
    });
    // Accordion summary is visible …
    expect(screen.getByLabelText('Danger zone')).toBeInTheDocument();
    // … but the destructive button is hidden inside the collapsed
    // accordion (rendered but role-hidden).
    expect(
      screen.queryByRole('button', { name: /remove deployment/i }),
    ).toBeNull();
  });

  it('reveals Remove deployment when the danger zone is expanded', async () => {
    const user = userEvent.setup();
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          bindingName: 'staging-binding',
        }),
      },
      onRemoveDeployment: jest.fn().mockResolvedValue(undefined),
    });
    await user.click(screen.getByLabelText('Danger zone'));
    expect(
      screen.getByRole('button', { name: /remove deployment/i }),
    ).toBeEnabled();
  });

  it('does not render the danger zone when the env has no binding', () => {
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({ name: 'staging' }),
      },
      onRemoveDeployment: jest.fn().mockResolvedValue(undefined),
    });
    expect(screen.queryByLabelText('Danger zone')).toBeNull();
    expect(
      screen.queryByRole('button', { name: /remove deployment/i }),
    ).toBeNull();
  });

  it('opens a confirmation dialog before firing onRemoveDeployment', async () => {
    const user = userEvent.setup();
    const onRemoveDeployment = jest.fn().mockResolvedValue(undefined);
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          bindingName: 'staging-binding',
        }),
      },
      onRemoveDeployment,
    });
    // Expand the danger zone first.
    await user.click(screen.getByLabelText('Danger zone'));
    await user.click(
      screen.getByRole('button', { name: /^remove deployment$/i }),
    );
    // Dialog opens, callback NOT yet fired
    expect(onRemoveDeployment).not.toHaveBeenCalled();
    expect(
      screen.getByText(/remove deployment from staging\?/i),
    ).toBeInTheDocument();

    // Confirm via the dialog's primary button
    await user.click(
      screen.getByRole('button', { name: /^remove deployment$/i }),
    );
    expect(onRemoveDeployment).toHaveBeenCalled();
  });

  it('shows the Rollout restart button when the env has an active deployment', () => {
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          bindingName: 'staging-binding',
          deployment: { status: 'Ready' },
        }),
      },
      onRolloutRestart: jest.fn().mockResolvedValue(undefined),
    });
    expect(
      screen.getByRole('button', { name: /rollout restart/i }),
    ).toBeEnabled();
  });

  it('hides Rollout restart when the env is undeployed', () => {
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          bindingName: 'staging-binding',
          deployment: { status: 'Ready', statusReason: 'ResourcesUndeployed' },
        }),
      },
      onRolloutRestart: jest.fn().mockResolvedValue(undefined),
    });
    expect(
      screen.queryByRole('button', { name: /rollout restart/i }),
    ).toBeNull();
  });

  it('hides Rollout restart when no bindingName exists', () => {
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          deployment: { status: 'Ready' },
        }),
      },
      onRolloutRestart: jest.fn().mockResolvedValue(undefined),
    });
    expect(
      screen.queryByRole('button', { name: /rollout restart/i }),
    ).toBeNull();
  });

  it('fires onRolloutRestart when the button is clicked', async () => {
    const user = userEvent.setup();
    const onRolloutRestart = jest.fn().mockResolvedValue(undefined);
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          bindingName: 'staging-binding',
          deployment: { status: 'Ready' },
        }),
      },
      onRolloutRestart,
    });
    await user.click(screen.getByRole('button', { name: /rollout restart/i }));
    expect(onRolloutRestart).toHaveBeenCalled();
  });

  it('renders Configure overrides as a text button (not as a header icon button)', () => {
    renderPanel({
      selection: { kind: 'env', environment: makeEnv({ name: 'staging' }) },
    });
    // Text-label button is present in the Configuration section.
    expect(
      screen.getByRole('button', { name: /^configure overrides$/i }),
    ).toBeInTheDocument();
    // The legacy header cogwheel form (IconButton with aria-label) is gone —
    // queryByLabelText only matches an explicit aria-label attribute.
    expect(screen.queryByLabelText('Configure overrides')).toBeNull();
  });

  it('renders the Promote footer when env has Ready status, binding, and at least one target', () => {
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          bindingName: 'staging-binding',
          deployment: { status: 'Ready' },
          promotionTargets: [{ name: 'prod', resourceName: 'prod-res' }],
        }),
      },
    });
    expect(
      screen.getByRole('button', { name: /^promote$/i }),
    ).toBeInTheDocument();
  });

  it('hides the Promote footer when env has no binding', () => {
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          deployment: { status: 'Ready' },
          promotionTargets: [{ name: 'prod', resourceName: 'prod-res' }],
        }),
      },
    });
    expect(screen.queryByRole('button', { name: /^promote$/i })).toBeNull();
  });

  it('hides the Promote footer when env has no targets', () => {
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          bindingName: 'staging-binding',
          deployment: { status: 'Ready' },
        }),
      },
    });
    expect(screen.queryByRole('button', { name: /^promote$/i })).toBeNull();
  });

  it('renders the release name in the header when present', () => {
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          bindingName: 'staging-binding',
          deployment: { status: 'Ready', releaseName: 'my-comp-rel-7' },
        }),
      },
    });
    expect(screen.getByText('my-comp-rel-7')).toBeInTheDocument();
    expect(screen.getByLabelText('Copy release name')).toBeInTheDocument();
    expect(screen.getByLabelText('View release')).toBeInTheDocument();
  });

  it('omits the release name row when the env has no release', () => {
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          bindingName: 'staging-binding',
          deployment: { status: 'Ready' },
        }),
      },
    });
    expect(screen.queryByLabelText('Copy release name')).toBeNull();
  });

  it('renders a short "Behind upstream" line when driftInfo.isBehind', () => {
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          bindingName: 'staging-binding',
          deployment: { status: 'Ready', releaseName: 'rel-5' },
        }),
      },
      driftInfo: {
        isBehind: true,
        aheadUpstreams: [{ envName: 'dev', releaseName: 'rel-7' }],
      },
    });
    expect(screen.getByText(/^Behind upstream$/)).toBeInTheDocument();
    // Full upstream details live on the tooltip, not inline.
    expect(screen.queryByText(/rel-7/)).toBeNull();
  });

  it('opens the release diff dialog from the drift "View diff" button', async () => {
    const user = userEvent.setup();
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          bindingName: 'staging-binding',
          deployment: { status: 'Ready', releaseName: 'rel-5' },
        }),
      },
      driftInfo: {
        isBehind: true,
        aheadUpstreams: [{ envName: 'dev', releaseName: 'rel-7' }],
      },
    });
    await user.click(screen.getByRole('button', { name: /view diff/i }));
    expect(await screen.findByTestId('diff-dialog')).toBeInTheDocument();
  });

  it('omits the drift line when not behind', () => {
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          bindingName: 'staging-binding',
          deployment: { status: 'Ready', releaseName: 'rel-7' },
        }),
      },
    });
    expect(screen.queryByText(/Behind/)).toBeNull();
  });

  it('renders an Endpoints section with View All when env has endpoints', () => {
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          bindingName: 'staging-binding',
          deployment: { status: 'Ready' },
          endpoints: [
            {
              name: 'web',
              externalURLs: {
                https: {
                  scheme: 'https',
                  host: 'web.staging.example.com',
                  port: 443,
                  path: '/',
                },
              },
            },
          ],
        }),
      },
    });
    expect(screen.getByText('Endpoints')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /view all/i }),
    ).toBeInTheDocument();
  });

  it('renders the first external URL inline with a copy button', () => {
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          bindingName: 'staging-binding',
          deployment: { status: 'Ready' },
          endpoints: [
            {
              name: 'web',
              externalURLs: {
                https: {
                  scheme: 'https',
                  host: 'web.staging.example.com',
                  port: 443,
                  path: '/',
                },
              },
            },
          ],
        }),
      },
    });
    expect(screen.getByText('External:')).toBeInTheDocument();
    expect(
      screen.getByText('https://web.staging.example.com:443/'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Copy URL')).toBeInTheDocument();
  });

  it('falls back to internal URL when no external URL exists', () => {
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          bindingName: 'staging-binding',
          deployment: { status: 'Ready' },
          endpoints: [
            {
              name: 'web',
              internalURLs: {
                http: {
                  scheme: 'http',
                  host: 'web.cluster.local',
                  port: 8080,
                  path: '/',
                },
              },
            },
          ],
        }),
      },
    });
    expect(screen.getByText('Internal:')).toBeInTheDocument();
    expect(
      screen.getByText('http://web.cluster.local:8080/'),
    ).toBeInTheDocument();
  });

  it('omits the Endpoints section when env has no endpoints', () => {
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          bindingName: 'staging-binding',
          deployment: { status: 'Ready' },
          endpoints: [],
        }),
      },
    });
    expect(screen.queryByText('Endpoints')).toBeNull();
    expect(screen.queryByRole('button', { name: /view all/i })).toBeNull();
  });

  it('renders Promote inside the Actions section, not in a bottom footer', () => {
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          bindingName: 'staging-binding',
          deployment: { status: 'Ready', releaseName: 'rel-7' },
          promotionTargets: [{ name: 'prod', resourceName: 'prod-res' }],
        }),
      },
    });
    const actionsHeading = screen.getByText('Actions');
    const promoteBtn = screen.getByRole('button', { name: /^promote$/i });
    // Walk up from the Promote button to the nearest section element.
    // It should be the same ancestor that contains the Actions heading.
    const sectionAncestor = promoteBtn.closest(
      `[class*="section"]`,
    ) as HTMLElement | null;
    expect(sectionAncestor).not.toBeNull();
    expect(sectionAncestor!.contains(actionsHeading)).toBe(true);
  });
});
