import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { TestApiProvider } from '@backstage/test-utils';
import { ResponseError } from '@backstage/errors';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import { ResourceEnvironments } from './ResourceEnvironments';

jest.mock('@backstage/core-components', () => ({
  Progress: () => <div data-testid="progress" />,
}));

jest.mock('@openchoreo/backstage-design-system', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  StatusBadge: ({ status }: any) => (
    <span data-testid="status-badge">{status}</span>
  ),
  useChoreoTokens: () => ({ graph: { canvasDotPattern: '' } }),
}));

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  ForbiddenState: ({ message }: any) => (
    <div data-testid="forbidden">{message}</div>
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
  // The canvas internals are exercised in their own test; here we stub the
  // graph layout so jsdom doesn't need to mount the real dagre + zoom infra.
  buildEnvPipelineNodes: (envs: any[]) =>
    envs.map((e: any) => ({ id: e.name, isSetup: false, data: e, parents: [] })),
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
  return render(
    <TestApiProvider apis={[[openChoreoClientApiRef, client as any]]}>
      <EntityProvider entity={makeEntity()}>
        <ResourceEnvironments />
      </EntityProvider>
    </TestApiProvider>,
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
    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('renders the canvas with env tiles and auto-selects the first one', async () => {
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
    // Auto-selected first env: detail panel shows its header
    expect(screen.getAllByText('dev').length).toBeGreaterThan(0);
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

      // Auto-selects dev → detail panel shows the Actions heading
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
  });

  describe('promote action', () => {
    const behind = [
      {
        name: 'dev',
        bindingName: 'b-dev',
        resourceRelease: 'rel-old',
        retainPolicy: 'Delete' as const,
        status: 'Ready' as const,
        latestRelease: 'rel-new',
      },
    ];

    it('calls updateResourceReleaseBinding with the latest release on Promote click', async () => {
      const client = {
        fetchResourceEnvironmentInfo: jest
          .fn()
          .mockResolvedValueOnce(behind)
          .mockResolvedValueOnce([{ ...behind[0], resourceRelease: 'rel-new' }]),
        updateResourceReleaseBinding: jest.fn().mockResolvedValue({}),
      };

      renderTab(client);

      const button = await screen.findByRole('button', { name: /promote/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(client.updateResourceReleaseBinding).toHaveBeenCalledWith(
          expect.anything(),
          'dev',
          { resourceRelease: 'rel-new' },
        );
      });
      expect(screen.getByTestId('notification').getAttribute('data-type')).toBe(
        'success',
      );
    });
  });

  describe('deploy action', () => {
    const envsWithUnbound = [{ name: 'staging', latestRelease: 'rel-1' }];

    it('calls updateResourceReleaseBinding when Deploy is clicked', async () => {
      const client = {
        fetchResourceEnvironmentInfo: jest
          .fn()
          .mockResolvedValueOnce(envsWithUnbound)
          .mockResolvedValueOnce([
            {
              ...envsWithUnbound[0],
              bindingName: 'b-staging',
              resourceRelease: 'rel-1',
              status: 'NotReady',
            },
          ]),
        updateResourceReleaseBinding: jest.fn().mockResolvedValue({}),
      };

      renderTab(client);

      fireEvent.click(await screen.findByRole('button', { name: /^deploy$/i }));

      await waitFor(() => {
        expect(client.updateResourceReleaseBinding).toHaveBeenCalledWith(
          expect.anything(),
          'staging',
          { resourceRelease: 'rel-1' },
        );
      });
      expect(screen.getByTestId('notification').getAttribute('data-type')).toBe(
        'success',
      );
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
        await screen.findByRole('button', { name: /^undeploy$/i }),
      );

      // Confirm dialog has its own Undeploy button — find by text inside the dialog
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
        await screen.findByRole('button', { name: /^undeploy$/i }),
      );
      fireEvent.click(
        await screen.findByRole('button', { name: /cancel/i }),
      );

      expect(client.deleteResourceReleaseBinding).not.toHaveBeenCalled();
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
  });
});
