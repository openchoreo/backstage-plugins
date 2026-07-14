import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { TestApiProvider } from '@backstage/test-utils';
import { ResponseError } from '@backstage/errors';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import { ResourceEnvironmentsList } from './ResourceEnvironmentsList';

jest.mock('@backstage/core-components', () => ({
  Progress: () => <div data-testid="progress" />,
  EmptyState: ({ missing, title, description }: any) => (
    <div data-testid={missing === 'data' ? 'error-state' : 'empty-state'}>
      <span>{title}</span>
      <span>{typeof description === 'string' ? description : ''}</span>
    </div>
  ),
}));

jest.mock('@openchoreo/backstage-design-system', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  StatusBadge: ({ status }: any) => (
    <span data-testid="status-badge">{status}</span>
  ),
  PageLoader: () => <div data-testid="page-loader" />,
  useChoreoTokens: () => ({ graph: { canvasDotPattern: '' } }),
}));

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  ForbiddenState: ({ message }: any) => (
    <div data-testid="forbidden">{message}</div>
  ),
  EmptyState: ({ title, description }: any) => (
    <div data-testid="empty-state">
      <span>{title}</span>
      <span>{description}</span>
    </div>
  ),
  ErrorState: ({ title, message }: any) => (
    <div data-testid="error-state">
      <span>{title}</span>
      <span>{message}</span>
    </div>
  ),
  useResourceReleaseBindingUpdatePermission: () => ({
    canUpdate: true,
    loading: false,
    deniedTooltip: '',
  }),
  useResourceReleaseBindingCreatePermission: () => ({
    canCreate: true,
    loading: false,
    deniedTooltip: '',
  }),
  useResourceReleaseBindingDeletePermission: () => ({
    canDelete: true,
    loading: false,
    deniedTooltip: '',
  }),
  useResourcePromoteToEnvPermission: () => ({
    canPromote: true,
    loading: false,
    deniedTooltip: '',
  }),
  // The canvas internals are exercised in their own test; here we stub the
  // graph layout so jsdom doesn't need to mount the real dagre + zoom infra.
  // Mirror the real buildEnvPipelineNodes shape: prepend a synthetic setup
  // node so the canvas exercises the Setup-tile render path.
  buildEnvPipelineNodes: (envs: any[]) => [
    { id: '__setup__', isSetup: true, data: undefined, parents: [] },
    ...envs.map((e: any) => ({
      id: e.name,
      isSetup: false,
      data: e,
      parents: [],
    })),
  ],
  computePipelineLayout: (nodes: any[]) => ({
    width: 200,
    height: 200,
    nodes: nodes.map(n => ({ ...n, x: 0, y: 0, width: 100, height: 100 })),
    edges: [],
  }),
  GraphControls: () => <div data-testid="graph-controls" />,
  PipelineEdge: () => null,
  MINI_ENV_NODE_WIDTH: 100,
  MINI_ENV_NODE_HEIGHT: 100,
  MINI_SETUP_NODE_WIDTH: 100,
  MINI_SETUP_NODE_HEIGHT: 100,
  useHtmlGraphZoom: () => ({
    containerRef: { current: null },
    contentRef: { current: null },
    containerSize: { width: 500, height: 500 },
    zoomIn: () => {},
    zoomOut: () => {},
    fitToView: () => {},
    resetZoom: () => {},
  }),
}));

jest.mock('../Environments/components', () => ({
  NotificationBanner: ({ notification }: any) =>
    notification ? (
      <div data-testid="notification" data-type={notification.type}>
        {notification.message}
      </div>
    ) : null,
}));

jest.mock('../Environments/components/NoEnvironmentsEmptyState', () => ({
  NoEnvironmentsEmptyState: () => (
    <div>
      This project's deployment pipeline has no environments configured.
    </div>
  ),
}));

function makeEntity(): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Resource',
    metadata: {
      name: 'analytics-db',
      namespace: 'finance',
      annotations: {
        'openchoreo.io/namespace': 'finance',
        'openchoreo.io/project': 'analytics',
        'openchoreo.io/resource': 'analytics-db',
      },
    },
    spec: { type: 'postgres' } as any,
  };
}

interface MockClient {
  fetchResourceEnvironmentInfo: jest.Mock;
  updateResourceReleaseBinding?: jest.Mock;
  deleteResourceReleaseBinding?: jest.Mock;
}

function renderTab(client: MockClient) {
  // The list view uses useNavigate for the Set up → Configure & Deploy
  // flow, so it needs a router context. Wrapping in MemoryRouter keeps
  // each test isolated from URL state.
  return render(
    <MemoryRouter>
      <TestApiProvider apis={[[openChoreoClientApiRef, client as any]]}>
        <EntityProvider entity={makeEntity()}>
          <ResourceEnvironmentsList />
        </EntityProvider>
      </TestApiProvider>
    </MemoryRouter>,
  );
}

async function makeForbidden(): Promise<ResponseError> {
  const response = new Response('forbidden', { status: 403 });
  return ResponseError.fromResponse(response);
}

describe('ResourceEnvironments', () => {
  it('shows a progress indicator while loading', () => {
    const client = {
      fetchResourceEnvironmentInfo: jest.fn(() => new Promise(() => {})),
    };
    renderTab(client);
    expect(screen.getByTestId('page-loader')).toBeInTheDocument();
  });

  it('renders the canvas with env tiles and starts with no env selected', async () => {
    const client = {
      fetchResourceEnvironmentInfo: jest.fn().mockResolvedValue([
        {
          name: 'dev',
          bindingName: 'b-dev',
          resourceRelease: 'rel-1',
          status: 'Ready',
          latestRelease: 'rel-1',
        },
        { name: 'staging', latestRelease: 'rel-1' },
      ]),
    };

    renderTab(client);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /select environment dev/i }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: /select environment staging/i }),
    ).toBeInTheDocument();
    // No env auto-selected: detail panel shows the empty-state copy
    expect(
      screen.getByText(/select an environment to view details/i),
    ).toBeInTheDocument();
    // Neither env tile is in the pressed state
    expect(
      screen
        .getByRole('button', { name: /select environment dev/i })
        .getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('renders an empty-state message when env-info returns no entries', async () => {
    const client = {
      fetchResourceEnvironmentInfo: jest.fn().mockResolvedValue([]),
    };

    renderTab(client);

    await waitFor(() => {
      expect(
        screen.getByText(/no environments configured/i),
      ).toBeInTheDocument();
    });
  });

  it('renders a generic error message on a non-403 failure', async () => {
    const client = {
      fetchResourceEnvironmentInfo: jest
        .fn()
        .mockRejectedValue(new Error('boom')),
    };

    renderTab(client);

    await waitFor(() => {
      expect(
        screen.getByText(/failed to load environments/i),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/boom/)).toBeInTheDocument();
  });

  it('renders the ForbiddenState when the BFF returns 403', async () => {
    const forbidden = await makeForbidden();
    const client = {
      fetchResourceEnvironmentInfo: jest.fn().mockRejectedValue(forbidden),
    };

    renderTab(client);

    await waitFor(() => {
      expect(screen.getByTestId('forbidden')).toBeInTheDocument();
    });
  });

  describe('selection', () => {
    const envs = [
      {
        name: 'dev',
        bindingName: 'b-dev',
        resourceRelease: 'rel-1',
        retainPolicy: 'Delete' as const,
        status: 'Ready' as const,
        latestRelease: 'rel-1',
      },
      { name: 'staging', latestRelease: 'rel-1' },
    ];

    it('switches the detail panel when a different env tile is clicked', async () => {
      const client = {
        fetchResourceEnvironmentInfo: jest.fn().mockResolvedValue(envs),
      };
      renderTab(client);

      // Click dev tile → detail panel shows the Actions heading
      fireEvent.click(
        await screen.findByRole('button', { name: /select environment dev/i }),
      );
      await waitFor(() => {
        expect(screen.getByText('Actions')).toBeInTheDocument();
      });

      // Click staging tile → detail panel switches to the "not deployed" body
      fireEvent.click(
        screen.getByRole('button', { name: /select environment staging/i }),
      );

      await waitFor(() => {
        expect(
          screen.getByText(/no binding in this environment yet/i),
        ).toBeInTheDocument();
      });
    });

    it('clears the env selection when the canvas background is clicked', async () => {
      const client = {
        fetchResourceEnvironmentInfo: jest.fn().mockResolvedValue(envs),
      };
      renderTab(client);

      // Pick dev so something is selected to clear.
      fireEvent.click(
        await screen.findByRole('button', { name: /select environment dev/i }),
      );
      await waitFor(() => {
        expect(screen.getByText('Actions')).toBeInTheDocument();
      });

      // Click on the canvas container itself (event.target === currentTarget).
      const canvas = document.querySelector<HTMLElement>(
        '[data-testid="resource-deploy-flow-canvas"]',
      );
      expect(canvas).not.toBeNull();
      fireEvent.click(canvas!);

      // Detail panel returns to the empty state.
      await waitFor(() => {
        expect(
          screen.getByText(/select an environment to view details/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe('setup tile', () => {
    const envs = [
      {
        name: 'dev',
        bindingName: 'b-dev',
        resourceRelease: 'rel-1',
        retainPolicy: 'Delete' as const,
        status: 'Ready' as const,
        latestRelease: 'rel-1',
      },
    ];

    it('renders the Setup tile alongside env tiles', async () => {
      const client = {
        fetchResourceEnvironmentInfo: jest.fn().mockResolvedValue(envs),
      };
      renderTab(client);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /select setup/i }),
        ).toBeInTheDocument();
      });
    });

    it('opens the Setup detail pane when the Setup tile is clicked', async () => {
      const client = {
        fetchResourceEnvironmentInfo: jest.fn().mockResolvedValue(envs),
      };
      renderTab(client);

      // Pick an env first so we can prove the Setup click swaps panes.
      fireEvent.click(
        await screen.findByRole('button', { name: /select environment dev/i }),
      );
      await waitFor(() => {
        expect(screen.getByText('Actions')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /select setup/i }));

      // Configure & Deploy button is the unique marker of the Setup pane.
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /configure & deploy/i }),
        ).toBeInTheDocument();
      });
      // Env-panel Actions heading is gone — only one pane shows at a time.
      expect(screen.queryByText('Actions')).not.toBeInTheDocument();
    });

    it('clears the Setup selection when a different env tile is clicked', async () => {
      const client = {
        fetchResourceEnvironmentInfo: jest.fn().mockResolvedValue(envs),
      };
      renderTab(client);

      // Open Setup pane.
      fireEvent.click(
        await screen.findByRole('button', { name: /select setup/i }),
      );
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /configure & deploy/i }),
        ).toBeInTheDocument();
      });

      // Click an env tile → env panel comes back, Setup pane goes away.
      fireEvent.click(
        screen.getByRole('button', { name: /select environment dev/i }),
      );
      await waitFor(() => {
        expect(screen.getByText('Actions')).toBeInTheDocument();
      });
      expect(
        screen.queryByRole('button', { name: /configure & deploy/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe('promote action', () => {
    // Dev has rel-abc, Staging has nothing → dev is eligible to promote
    // forward to staging. Mirrors Component's forward-promote semantic.
    const forwardable = [
      {
        name: 'dev',
        bindingName: 'b-dev',
        resourceRelease: 'rel-abc',
        retainPolicy: 'Delete' as const,
        status: 'Ready' as const,
        promotionTargets: [{ name: 'staging' }],
      },
      {
        name: 'staging',
        resourceName: 'staging',
      },
    ];

    it('promotes this env release to the next env via the panel Promote button', async () => {
      const client = {
        fetchResourceEnvironmentInfo: jest
          .fn()
          .mockResolvedValueOnce(forwardable)
          .mockResolvedValueOnce([
            forwardable[0],
            { ...forwardable[1], resourceRelease: 'rel-abc' },
          ]),
        updateResourceReleaseBinding: jest.fn().mockResolvedValue({}),
      };

      renderTab(client);

      fireEvent.click(
        await screen.findByRole('button', { name: /select environment dev/i }),
      );

      // Panel Promote button reads plain "Promote" (matches Component).
      // Anchor to disambiguate from the env card's "Promote dev to staging".
      const button = await screen.findByRole('button', {
        name: /^promote$/i,
      });
      fireEvent.click(button);

      await waitFor(() => {
        expect(client.updateResourceReleaseBinding).toHaveBeenCalledWith(
          expect.anything(),
          'staging',
          { resourceRelease: 'rel-abc' },
        );
      });
      expect(screen.getByTestId('notification').getAttribute('data-type')).toBe(
        'success',
      );
    });
  });

  describe('deploy-model alignment', () => {
    const envsWithUnbound = [{ name: 'staging', latestRelease: 'rel-1' }];

    it('does not expose a Deploy button on the unbound env detail panel', async () => {
      const client = {
        fetchResourceEnvironmentInfo: jest
          .fn()
          .mockResolvedValue(envsWithUnbound),
        updateResourceReleaseBinding: jest.fn().mockResolvedValue({}),
      };

      renderTab(client);

      fireEvent.click(
        await screen.findByRole('button', {
          name: /select environment staging/i,
        }),
      );

      await waitFor(() => {
        expect(
          screen.getByText(/no binding in this environment yet/i),
        ).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: /^deploy$/i })).toBeNull();
      expect(client.updateResourceReleaseBinding).not.toHaveBeenCalled();
    });
  });

  describe('undeploy action', () => {
    const bound = [
      {
        name: 'dev',
        bindingName: 'b-dev',
        resourceRelease: 'rel-1',
        retainPolicy: 'Delete' as const,
        status: 'Ready' as const,
        latestRelease: 'rel-1',
      },
    ];

    it('opens a confirmation dialog and only deletes after Confirm', async () => {
      const client = {
        fetchResourceEnvironmentInfo: jest
          .fn()
          .mockResolvedValueOnce(bound)
          .mockResolvedValueOnce([{ name: 'dev', latestRelease: 'rel-1' }]),
        deleteResourceReleaseBinding: jest.fn().mockResolvedValue({}),
      };

      renderTab(client);

      fireEvent.click(
        await screen.findByRole('button', { name: /select environment dev/i }),
      );
      fireEvent.click(await screen.findByLabelText('Danger zone'));
      fireEvent.click(
        await screen.findByRole('button', { name: /^remove deployment$/i }),
      );

      // Confirm dialog has its own Remove deployment button — find by text inside the dialog
      const dialog = await screen.findByRole('dialog');
      const confirmButton = dialog.querySelector(
        'button.MuiButton-containedSecondary',
      ) as HTMLButtonElement;
      expect(confirmButton).toBeTruthy();
      expect(client.deleteResourceReleaseBinding).not.toHaveBeenCalled();

      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(client.deleteResourceReleaseBinding).toHaveBeenCalledWith(
          expect.anything(),
          'dev',
        );
      });
    });

    it('does not delete when the dialog is cancelled', async () => {
      const client = {
        fetchResourceEnvironmentInfo: jest.fn().mockResolvedValue(bound),
        deleteResourceReleaseBinding: jest.fn(),
      };

      renderTab(client);

      fireEvent.click(
        await screen.findByRole('button', { name: /select environment dev/i }),
      );
      fireEvent.click(await screen.findByLabelText('Danger zone'));
      fireEvent.click(
        await screen.findByRole('button', { name: /^remove deployment$/i }),
      );
      fireEvent.click(await screen.findByRole('button', { name: /cancel/i }));

      expect(client.deleteResourceReleaseBinding).not.toHaveBeenCalled();
    });

    it('passes resourceName (not display name) to the client', async () => {
      // BFF surfaces both: name=displayName ("Production"), resourceName=K8s
      // RFC 1123 name ("production"). Mirrors the promote regression in
      // ResourceMiniEnvironmentNode.test.tsx; same bug class on undeploy.
      const boundProd = [
        {
          name: 'Production',
          resourceName: 'production',
          bindingName: 'b-prod',
          resourceRelease: 'rel-1',
          retainPolicy: 'Delete' as const,
          status: 'Ready' as const,
          latestRelease: 'rel-1',
        },
      ];
      const client = {
        fetchResourceEnvironmentInfo: jest
          .fn()
          .mockResolvedValueOnce(boundProd)
          .mockResolvedValueOnce([
            {
              name: 'Production',
              resourceName: 'production',
              latestRelease: 'rel-1',
            },
          ]),
        deleteResourceReleaseBinding: jest.fn().mockResolvedValue({}),
      };

      renderTab(client);

      fireEvent.click(
        await screen.findByRole('button', {
          name: /select environment production/i,
        }),
      );
      fireEvent.click(await screen.findByLabelText('Danger zone'));
      fireEvent.click(
        await screen.findByRole('button', { name: /^remove deployment$/i }),
      );

      const dialog = await screen.findByRole('dialog');
      const confirmButton = dialog.querySelector(
        'button.MuiButton-containedSecondary',
      ) as HTMLButtonElement;
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(client.deleteResourceReleaseBinding).toHaveBeenCalledWith(
          expect.anything(),
          'production',
        );
      });
    });
  });

  describe('retain policy change', () => {
    const bound = [
      {
        name: 'dev',
        bindingName: 'b-dev',
        resourceRelease: 'rel-1',
        retainPolicy: 'Delete' as const,
        status: 'Ready' as const,
        latestRelease: 'rel-1',
      },
    ];

    it('PUTs the binding with the new retainPolicy when Retain is selected', async () => {
      const client = {
        fetchResourceEnvironmentInfo: jest
          .fn()
          .mockResolvedValueOnce(bound)
          .mockResolvedValueOnce([{ ...bound[0], retainPolicy: 'Retain' }]),
        updateResourceReleaseBinding: jest.fn().mockResolvedValue({}),
      };

      renderTab(client);

      fireEvent.click(
        await screen.findByRole('button', { name: /select environment dev/i }),
      );
      fireEvent.click(await screen.findByLabelText('Danger zone'));
      const retainButton = await screen.findByRole('button', {
        name: /^retain$/i,
      });
      fireEvent.click(retainButton);

      await waitFor(() => {
        expect(client.updateResourceReleaseBinding).toHaveBeenCalledWith(
          expect.anything(),
          'dev',
          { resourceRelease: 'rel-1', retainPolicy: 'Retain' },
        );
      });
    });

    it('passes resourceName (not display name) to the client', async () => {
      const boundProd = [
        {
          name: 'Production',
          resourceName: 'production',
          bindingName: 'b-prod',
          resourceRelease: 'rel-1',
          retainPolicy: 'Delete' as const,
          status: 'Ready' as const,
          latestRelease: 'rel-1',
        },
      ];
      const client = {
        fetchResourceEnvironmentInfo: jest
          .fn()
          .mockResolvedValueOnce(boundProd)
          .mockResolvedValueOnce([{ ...boundProd[0], retainPolicy: 'Retain' }]),
        updateResourceReleaseBinding: jest.fn().mockResolvedValue({}),
      };

      renderTab(client);

      fireEvent.click(
        await screen.findByRole('button', {
          name: /select environment production/i,
        }),
      );
      fireEvent.click(await screen.findByLabelText('Danger zone'));
      const retainButton = await screen.findByRole('button', {
        name: /^retain$/i,
      });
      fireEvent.click(retainButton);

      await waitFor(() => {
        expect(client.updateResourceReleaseBinding).toHaveBeenCalledWith(
          expect.anything(),
          'production',
          { resourceRelease: 'rel-1', retainPolicy: 'Retain' },
        );
      });
    });
  });
});
