import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ResourceMiniEnvironmentNode } from './ResourceMiniEnvironmentNode';
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

const mockPromotePerm = jest.fn();
const mockUpdatePerm = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  formatRelativeTime: () => 'just now',
  useResourcePromoteToEnvPermission: (env: string) => mockPromotePerm(env),
  useResourceReleaseBindingUpdatePermission: (env?: string) =>
    mockUpdatePerm(env),
}));

beforeEach(() => {
  jest.clearAllMocks();
  // Default to allowed so existing tests keep passing; gating tests override.
  mockPromotePerm.mockReturnValue({
    canPromote: true,
    loading: false,
    deniedTooltip: '',
  });
  mockUpdatePerm.mockReturnValue({
    canUpdate: true,
    loading: false,
    deniedTooltip: '',
  });
});

function bound(): ResourceEnvironment {
  return {
    name: 'dev',
    resourceName: 'dev',
    bindingName: 'b-dev',
    resourceRelease: 'rel-abc',
    status: 'Ready',
    latestRelease: 'rel-abc',
    lastDeployed: '2026-01-01T00:00:00Z',
  };
}

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

function renderTile(
  env: ResourceEnvironment,
  selected = false,
  onSelect: () => void = () => {},
  ctxOverrides: Partial<ResourceEnvironmentsContextValue> = {},
) {
  return render(
    <MemoryRouter>
      <ResourceEnvironmentsProvider value={makeCtx(ctxOverrides)}>
        <ResourceMiniEnvironmentNode
          env={env}
          selected={selected}
          onSelect={onSelect}
        />
      </ResourceEnvironmentsProvider>
    </MemoryRouter>,
  );
}

describe('ResourceMiniEnvironmentNode', () => {
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

  it('calls onSelect when the tile body is clicked', () => {
    const onSelect = jest.fn();
    renderTile(bound(), false, onSelect);
    fireEvent.click(
      screen.getByRole('button', { name: /select environment dev/i }),
    );
    expect(onSelect).toHaveBeenCalled();
  });

  it('marks itself aria-pressed when selected', () => {
    renderTile(bound(), true);
    expect(
      screen.getByRole('button', { name: /select environment dev/i }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('handles Enter and Space keys to select', () => {
    const onSelect = jest.fn();
    renderTile(bound(), false, onSelect);
    const tile = screen.getByRole('button', {
      name: /select environment dev/i,
    });
    fireEvent.keyDown(tile, { key: 'Enter' });
    fireEvent.keyDown(tile, { key: ' ' });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  describe('actions menu', () => {
    it('opens the menu without selecting the tile', () => {
      const onSelect = jest.fn();
      renderTile(bound(), false, onSelect);

      fireEvent.click(screen.getByRole('button', { name: /actions for dev/i }));

      expect(
        screen.getByRole('menuitem', { name: /refresh/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('menuitem', { name: /configure overrides/i }),
      ).toBeInTheDocument();
      // The wrapping tile's onSelect must not fire when opening the menu.
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('invokes refetch from context when Refresh is chosen', () => {
      const refetch = jest.fn();
      renderTile(bound(), false, () => {}, { refetch });

      fireEvent.click(screen.getByRole('button', { name: /actions for dev/i }));
      fireEvent.click(screen.getByRole('menuitem', { name: /refresh/i }));

      expect(refetch).toHaveBeenCalled();
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

    it('opens the release manifest dialog via the View release menu item', () => {
      const onViewReleaseManifest = jest.fn();
      renderTile(bound(), false, () => {}, { onViewReleaseManifest });

      fireEvent.click(screen.getByRole('button', { name: /actions for dev/i }));
      fireEvent.click(
        screen.getByRole('menuitem', { name: /view release manifest/i }),
      );

      expect(onViewReleaseManifest).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'dev', resourceRelease: 'rel-abc' }),
      );
    });

    it('disables View release manifest when no release pinned', () => {
      renderTile({ name: 'staging' });
      fireEvent.click(
        screen.getByRole('button', { name: /actions for staging/i }),
      );
      expect(
        screen.getByRole('menuitem', { name: /view release manifest/i }),
      ).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('inline promote action', () => {
    const env: ResourceEnvironment = {
      ...bound(),
      promotionTargets: [{ name: 'staging' }],
    };
    const stagingBehind: ResourceEnvironment = {
      name: 'staging',
      resourceName: 'staging',
      // staging exists but is pinned to a different (older) release —
      // so dev's release is eligible to be promoted forward.
      resourceRelease: 'rel-old',
      status: 'NotReady',
    };
    const stagingInSync: ResourceEnvironment = {
      name: 'staging',
      resourceName: 'staging',
      resourceRelease: 'rel-abc',
      status: 'Ready',
    };

    it('shows Promote when next env is behind this env release', () => {
      renderTile(env, false, () => {}, {
        environments: [env, stagingBehind],
      });
      expect(
        screen.getByRole('button', { name: /promote dev to staging/i }),
      ).toBeInTheDocument();
    });

    it('shows disabled Promoted when next env already has this release', () => {
      renderTile(env, false, () => {}, {
        environments: [env, stagingInSync],
      });
      const button = screen.getByRole('button', { name: /^promoted$/i });
      expect(button).toBeInTheDocument();
      expect(button).toBeDisabled();
    });

    it('calls onPromote with the next env name and this env release on click', () => {
      const onPromote = jest.fn();
      renderTile(env, false, () => {}, {
        environments: [env, stagingBehind],
        onPromote,
      });

      fireEvent.click(
        screen.getByRole('button', { name: /promote dev to staging/i }),
      );
      expect(onPromote).toHaveBeenCalledWith('staging', 'rel-abc');
    });

    it('prefers target.resourceName over target.name (display name) on promote', () => {
      // BFF surfaces both: name=displayName ("Production"), resourceName=K8s
      // RFC 1123 name ("production"). The promote call must use the
      // resource name; passing the display name produces a binding
      // metadata.name like "orders-db-Production" that K8s rejects.
      const onPromote = jest.fn();
      const devToProd: ResourceEnvironment = {
        ...bound(),
        promotionTargets: [{ name: 'Production', resourceName: 'production' }],
      };
      const prodEnv: ResourceEnvironment = {
        name: 'Production',
        resourceName: 'production',
        resourceRelease: 'rel-old',
      };
      renderTile(devToProd, false, () => {}, {
        environments: [devToProd, prodEnv],
        onPromote,
      });

      fireEvent.click(
        screen.getByRole('button', { name: /promote dev to production/i }),
      );
      expect(onPromote).toHaveBeenCalledWith('production', 'rel-abc');
    });

    it('shows Promoting... while the promote is in flight', () => {
      renderTile(env, false, () => {}, {
        environments: [env, stagingBehind],
        pendingAction: { env: 'staging', kind: 'promote' },
      });
      expect(screen.getByText('Promoting...')).toBeInTheDocument();
    });

    it('hides the promote button when there are no promotion targets', () => {
      // Production (last env in pipeline) — no promotionTargets.
      const prod: ResourceEnvironment = {
        ...bound(),
        name: 'prod',
        resourceName: 'prod',
        promotionTargets: [],
      };
      renderTile(prod, false, () => {}, { environments: [prod] });
      expect(screen.queryByRole('button', { name: /^promote/i })).toBeNull();
    });

    it('hides the promote button when this env has no binding', () => {
      const unbound: ResourceEnvironment = {
        name: 'dev',
        resourceName: 'dev',
        promotionTargets: [{ name: 'staging' }],
      };
      renderTile(unbound, false, () => {}, { environments: [unbound] });
      expect(screen.queryByRole('button', { name: /^promote/i })).toBeNull();
    });

    it('renders a lowercase "behind" drift badge when an upstream is ahead', () => {
      renderTile(bound(), false, () => {}, {
        driftByEnv: new Map([
          [
            'dev',
            {
              isBehind: true,
              aheadUpstreams: [{ envName: 'upstream', releaseName: 'rel-new' }],
            },
          ],
        ]),
      });
      const badge = screen.getByLabelText('behind upstream');
      expect(badge).toBeInTheDocument();
      expect(badge.textContent).toBe('behind');
    });

    it('omits the drift badge when not behind', () => {
      renderTile(bound(), false, () => {}, {
        driftByEnv: new Map([['dev', { isBehind: false, aheadUpstreams: [] }]]),
      });
      expect(screen.queryByLabelText('behind upstream')).toBeNull();
    });

    describe('multi-target dropdown', () => {
      const devWithMulti: ResourceEnvironment = {
        ...bound(),
        promotionTargets: [{ name: 'stagingA' }, { name: 'stagingB' }],
      };
      const stagingABehind: ResourceEnvironment = {
        name: 'stagingA',
        resourceName: 'stagingA',
        resourceRelease: 'rel-old',
      };
      const stagingBInSync: ResourceEnvironment = {
        name: 'stagingB',
        resourceName: 'stagingB',
        resourceRelease: 'rel-abc',
      };

      it('opens a target picker when more than one eligible target exists', () => {
        renderTile(devWithMulti, false, () => {}, {
          environments: [
            devWithMulti,
            stagingABehind,
            { name: 'stagingB', resourceName: 'stagingB' },
          ],
        });

        fireEvent.click(screen.getByRole('button', { name: /^promote dev$/i }));
        expect(
          screen.getByRole('menuitem', { name: /promote to stagingA/i }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole('menuitem', { name: /promote to stagingB/i }),
        ).toBeInTheDocument();
      });

      it('disables targets already in sync inside the picker', () => {
        renderTile(devWithMulti, false, () => {}, {
          environments: [devWithMulti, stagingABehind, stagingBInSync],
        });

        fireEvent.click(screen.getByRole('button', { name: /^promote dev$/i }));
        expect(
          screen.getByRole('menuitem', { name: /promoted to stagingB/i }),
        ).toHaveAttribute('aria-disabled', 'true');
        expect(
          screen.getByRole('menuitem', { name: /promote to stagingA/i }),
        ).not.toHaveAttribute('aria-disabled', 'true');
      });

      it('calls onPromote with the chosen target', () => {
        const onPromote = jest.fn();
        renderTile(devWithMulti, false, () => {}, {
          environments: [
            devWithMulti,
            stagingABehind,
            { name: 'stagingB', resourceName: 'stagingB' },
          ],
          onPromote,
        });

        fireEvent.click(screen.getByRole('button', { name: /^promote dev$/i }));
        fireEvent.click(
          screen.getByRole('menuitem', { name: /promote to stagingB/i }),
        );
        expect(onPromote).toHaveBeenCalledWith('stagingB', 'rel-abc');
      });
    });
  });

  // ABAC env-aware permission gating. The Resource Deploy tab honors the same
  // `resource.environment` CEL constraints as Component side; without these
  // checks a developer with `releasebinding:update` allowed on non-prod envs
  // saw an enabled "Promote to Production" button that 403'd on click.
  // Mirrors MiniEnvironmentNode.test.tsx coverage for Components.
  describe('permission gating', () => {
    const devToProd: ResourceEnvironment = {
      ...bound(),
      promotionTargets: [{ name: 'Production', resourceName: 'production' }],
    };
    const prodBehind: ResourceEnvironment = {
      name: 'Production',
      resourceName: 'production',
      resourceRelease: 'rel-old',
    };

    it('queries promote permission using the target resourceName, not the display name', () => {
      renderTile(devToProd, false, () => {}, {
        environments: [devToProd, prodBehind],
      });
      // ABAC matches on the lowercase RFC 1123 name; passing the display
      // name ("Production") lets the prod-deny CEL slip through.
      expect(mockPromotePerm).toHaveBeenCalledWith('production');
    });

    it('disables the single-target Promote button when promote perm is denied', () => {
      mockPromotePerm.mockReturnValue({
        canPromote: false,
        loading: false,
        deniedTooltip: 'You do not have permission to promote to production',
      });
      renderTile(devToProd, false, () => {}, {
        environments: [devToProd, prodBehind],
      });
      const button = screen.getByRole('button', {
        name: /promote dev to production/i,
      });
      expect(button).toBeDisabled();
    });

    it('disables a multi-target promote MenuItem when its target denies promote perm', () => {
      const devToTwo: ResourceEnvironment = {
        ...bound(),
        promotionTargets: [
          { name: 'staging', resourceName: 'staging' },
          { name: 'Production', resourceName: 'production' },
        ],
      };
      const stagingBehind: ResourceEnvironment = {
        name: 'staging',
        resourceName: 'staging',
        resourceRelease: 'rel-old',
      };
      // Only deny on production; staging stays allowed so the row-by-row
      // gating assertion is meaningful.
      mockPromotePerm.mockImplementation((env: string) =>
        env === 'production'
          ? {
              canPromote: false,
              loading: false,
              deniedTooltip: 'denied',
            }
          : {
              canPromote: true,
              loading: false,
              deniedTooltip: '',
            },
      );
      renderTile(devToTwo, false, () => {}, {
        environments: [devToTwo, stagingBehind, prodBehind],
      });
      fireEvent.click(screen.getByRole('button', { name: /^promote dev$/i }));
      expect(
        screen.getByRole('menuitem', { name: /promote to production/i }),
      ).toHaveAttribute('aria-disabled', 'true');
      expect(
        screen.getByRole('menuitem', { name: /promote to staging/i }),
      ).not.toHaveAttribute('aria-disabled', 'true');
    });

    it('queries Configure overrides permission with the env resourceName', () => {
      const prodEnv: ResourceEnvironment = {
        ...bound(),
        name: 'Production',
        resourceName: 'production',
      };
      renderTile(prodEnv);
      expect(mockUpdatePerm).toHaveBeenCalledWith('production');
    });

    it('disables Configure overrides when binding-update perm is denied', () => {
      mockUpdatePerm.mockReturnValue({
        canUpdate: false,
        loading: false,
        deniedTooltip: 'no update',
      });
      renderTile(bound());
      fireEvent.click(screen.getByRole('button', { name: /actions for dev/i }));
      expect(
        screen.getByRole('menuitem', { name: /configure overrides/i }),
      ).toHaveAttribute('aria-disabled', 'true');
    });
  });
});
