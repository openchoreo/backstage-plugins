import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { TestApiProvider } from '@backstage/test-utils';
import { ResponseError } from '@backstage/errors';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import { EndpointEnvironmentsList } from './EndpointEnvironmentsList';

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
  YamlViewer: () => null,
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
  useEndpointReleaseBindingUpdatePermission: () => ({
    canUpdate: true,
    loading: false,
    deniedTooltip: '',
  }),
  useEndpointReleaseBindingCreatePermission: () => ({
    canCreate: true,
    loading: false,
    deniedTooltip: '',
  }),
  useEndpointReleaseBindingDeletePermission: () => ({
    canDelete: true,
    loading: false,
    deniedTooltip: '',
  }),
  useEndpointPromoteToEnvPermission: () => ({
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

const ENTITY: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Endpoint',
  metadata: {
    name: 'orders-api',
    namespace: 'acme',
    annotations: {
      'openchoreo.io/namespace': 'acme',
      'openchoreo.io/project': 'store',
      'openchoreo.io/endpoint': 'orders-api',
    },
  },
  spec: { type: 'http-route' } as any,
};

const ENVS = [
  {
    name: 'Development',
    resourceName: 'development',
    latestRelease: 'orders-api-abc',
    promotionTargets: [{ name: 'Production', resourceName: 'production' }],
  },
  {
    name: 'Production',
    resourceName: 'production',
    latestRelease: 'orders-api-abc',
  },
];

function renderList(client: Record<string, jest.Mock>) {
  return render(
    <MemoryRouter>
      <TestApiProvider apis={[[openChoreoClientApiRef, client as any]]}>
        <EntityProvider entity={ENTITY}>
          <EndpointEnvironmentsList />
        </EntityProvider>
      </TestApiProvider>
    </MemoryRouter>,
  );
}

describe('EndpointEnvironmentsList', () => {
  it('renders a tile per environment on the canvas', async () => {
    renderList({
      fetchEndpointEnvironmentInfo: jest.fn().mockResolvedValue(ENVS),
    });

    expect(
      await screen.findByTestId('endpoint-deploy-flow-canvas'),
    ).toBeInTheDocument();
    expect(screen.getByText('Development')).toBeInTheDocument();
    expect(screen.getByText('Production')).toBeInTheDocument();
  });

  it('deploys the latest release to the first environment from Set up', async () => {
    const updateEndpointReleaseBinding = jest.fn().mockResolvedValue({});
    renderList({
      fetchEndpointEnvironmentInfo: jest.fn().mockResolvedValue(ENVS),
      updateEndpointReleaseBinding,
    });

    fireEvent.click(
      await screen.findByRole('button', { name: 'Select setup' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Deploy to Development' }),
    );

    await waitFor(() =>
      expect(updateEndpointReleaseBinding).toHaveBeenCalledWith(
        ENTITY,
        'development',
        { endpointRelease: 'orders-api-abc' },
      ),
    );
  });

  it('shows a forbidden state when the user cannot view environments', async () => {
    renderList({
      fetchEndpointEnvironmentInfo: jest
        .fn()
        .mockRejectedValue(
          await ResponseError.fromResponse(
            new Response('forbidden', { status: 403 }),
          ),
        ),
    });

    expect(await screen.findByTestId('forbidden')).toBeInTheDocument();
  });
});
