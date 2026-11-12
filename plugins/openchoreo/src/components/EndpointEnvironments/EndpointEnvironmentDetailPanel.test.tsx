import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { EndpointEnvironment } from '../../api/OpenChoreoClientApi';
import { EndpointEnvironmentDetailPanel } from './EndpointEnvironmentDetailPanel';
import { EndpointSetupDetailPane } from './EndpointSetup';
import {
  EndpointEnvironmentsProvider,
  type EndpointEnvironmentsContextValue,
} from './EndpointEnvironmentsContext';

// The Backends section reads the catalog entity and calls the API; it has its
// own test file.
// It reports a saved change through onChanged, which these tests trigger.
jest.mock('./EndpointBackendsSection', () => ({
  EndpointBackendsSection: ({ awaiting, onChanged }: any) => (
    <div data-testid="backends-section" data-awaiting={String(awaiting)}>
      <button
        type="button"
        onClick={() => onChanged({ kind: 'add', backendName: 'canary' })}
      >
        save change
      </button>
    </div>
  ),
}));

// The Set up pane reads the backends from the catalog entity.
let mockBackends: unknown[] = [{ name: 'primary', weight: 1 }];
const mockRefresh = jest.fn();
jest.mock('@backstage/plugin-catalog-react', () => ({
  ...jest.requireActual('@backstage/plugin-catalog-react'),
  useEntity: () => ({
    entity: {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Endpoint',
      metadata: { name: 'orders-api' },
      spec: { backends: mockBackends },
    },
  }),
  useAsyncEntity: () => ({ refresh: mockRefresh }),
}));

jest.mock('@openchoreo/backstage-design-system', () => ({
  StatusBadge: ({ status }: any) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

const mockPromotePerm = jest.fn();
const mockDeletePerm = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  formatRelativeTime: () => 'just now',
  useEndpointReleaseBindingUpdatePermission: () => ({
    canUpdate: true,
    loading: false,
    deniedTooltip: '',
  }),
  useEndpointReleaseBindingDeletePermission: (env?: string) =>
    mockDeletePerm(env),
  useEndpointPromoteToEnvPermission: (env: string) => mockPromotePerm(env),
}));

function makeCtx(
  overrides: Partial<EndpointEnvironmentsContextValue> = {},
): EndpointEnvironmentsContextValue {
  return {
    environments: [],
    refetch: jest.fn(),
    pendingAction: null,
    driftByEnv: new Map(),
    onPromote: jest.fn(),
    onUndeployRequest: jest.fn(),
    onViewReleaseManifest: jest.fn(),
    ...overrides,
  };
}

function renderWithCtx(
  ui: JSX.Element,
  ctx: Partial<EndpointEnvironmentsContextValue> = {},
) {
  return render(
    <MemoryRouter>
      <EndpointEnvironmentsProvider value={makeCtx(ctx)}>
        {ui}
      </EndpointEnvironmentsProvider>
    </MemoryRouter>,
  );
}

const dev: EndpointEnvironment = {
  name: 'Development',
  resourceName: 'development',
  bindingName: 'orders-api-development',
  endpointRelease: 'orders-api-abc',
  latestRelease: 'orders-api-abc',
  status: 'Ready',
  promotionTargets: [{ name: 'Production', resourceName: 'production' }],
  backends: [
    {
      name: 'primary',
      kind: 'Component',
      weight: 90,
      resolved: true,
      serviceURL: { scheme: 'http', host: 'orders.dp.svc', port: 8080 },
    },
    {
      name: 'canary',
      kind: 'Component',
      weight: 10,
      resolved: false,
      reason: 'BackendNotExposed',
      message: 'workload endpoint http has project visibility',
    },
  ],
};
const prod: EndpointEnvironment = {
  name: 'Production',
  resourceName: 'production',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPromotePerm.mockReturnValue({
    canPromote: true,
    loading: false,
    deniedTooltip: '',
  });
  mockDeletePerm.mockReturnValue({
    canDelete: true,
    loading: false,
    deniedTooltip: '',
  });
});

describe('EndpointEnvironmentDetailPanel', () => {
  it('shows how each backend resolved in the environment', () => {
    renderWithCtx(
      <EndpointEnvironmentDetailPanel env={dev} onClose={() => {}} />,
      { environments: [dev, prod] },
    );

    expect(screen.getByText('Backends (2)')).toBeInTheDocument();
    expect(screen.getByText('http://orders.dp.svc:8080')).toBeInTheDocument();
    expect(
      screen.getByText(
        'BackendNotExposed: workload endpoint http has project visibility',
      ),
    ).toBeInTheDocument();
  });

  it('lists the URLs the Endpoint is invoked at, with their security', () => {
    renderWithCtx(
      <EndpointEnvironmentDetailPanel
        env={{
          ...dev,
          urls: {
            external: {
              scheme: 'https',
              host: 'orders.dev.example.com',
              port: 443,
              path: '/orders',
              security: {
                scheme: 'apiKey',
                apiKey: { in: 'header', name: 'api-key' },
              },
            },
            namespace: { scheme: '', host: 'orders-api.dp.svc', port: 9000 },
          },
        }}
        onClose={() => {}}
      />,
      { environments: [dev, prod] },
    );

    expect(screen.getByText('Invoke URLs')).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: 'https://orders.dev.example.com:443/orders',
      }),
    ).toBeInTheDocument();
    // The security is a padlock, described by its label and tooltip.
    expect(
      screen.getByRole('img', { name: 'API key (header api-key)' }),
    ).toBeInTheDocument();
    // An address without a scheme is shown, not linked.
    expect(screen.getByText('orders-api.dp.svc:9000')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'orders-api.dp.svc:9000' }),
    ).not.toBeInTheDocument();
  });

  it('shows no URLs before the binding resolves any', () => {
    renderWithCtx(
      <EndpointEnvironmentDetailPanel env={dev} onClose={() => {}} />,
      { environments: [dev, prod] },
    );
    expect(screen.queryByText('Invoke URLs')).not.toBeInTheDocument();
  });

  it('promotes the release to the next environment by its K8s name', () => {
    const onPromote = jest.fn();
    renderWithCtx(
      <EndpointEnvironmentDetailPanel env={dev} onClose={() => {}} />,
      { environments: [dev, prod], onPromote },
    );

    fireEvent.click(screen.getByRole('button', { name: /^promote$/i }));

    expect(mockPromotePerm).toHaveBeenCalledWith('production');
    expect(onPromote).toHaveBeenCalledWith('production', 'orders-api-abc');
  });

  it('requests removal of the deployment', () => {
    const onUndeployRequest = jest.fn();
    renderWithCtx(
      <EndpointEnvironmentDetailPanel env={dev} onClose={() => {}} />,
      { environments: [dev, prod], onUndeployRequest },
    );

    fireEvent.click(screen.getByRole('button', { name: /danger zone/i }));
    fireEvent.click(screen.getByRole('button', { name: /remove deployment/i }));

    expect(onUndeployRequest).toHaveBeenCalledWith('development');
  });

  it('explains an environment without a binding', () => {
    renderWithCtx(
      <EndpointEnvironmentDetailPanel env={prod} onClose={() => {}} />,
    );

    expect(
      screen.getByText(/not deployed to this environment yet/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/backends/i)).toBeNull();
  });
});

describe('EndpointSetupDetailPane', () => {
  it('deploys the latest release to the first environment', () => {
    const onPromote = jest.fn();
    renderWithCtx(
      <EndpointSetupDetailPane
        firstEnvironment={{ ...prod, latestRelease: 'orders-api-def' }}
        onClose={() => {}}
      />,
      { onPromote },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Deploy' }));

    expect(onPromote).toHaveBeenCalledWith('production', 'orders-api-def');
  });

  it('is disabled when the first environment already runs the latest release', () => {
    renderWithCtx(
      <EndpointSetupDetailPane firstEnvironment={dev} onClose={() => {}} />,
    );

    expect(screen.getByRole('button', { name: 'Deploy' })).toBeDisabled();
    expect(
      screen.getByText(/already runs the latest release/i),
    ).toBeInTheDocument();
  });

  it('is disabled until the endpoint has a release', () => {
    renderWithCtx(
      <EndpointSetupDetailPane firstEnvironment={prod} onClose={() => {}} />,
    );

    expect(screen.getByRole('button', { name: 'Deploy' })).toBeDisabled();
    expect(screen.getByText(/has no release yet/i)).toBeInTheDocument();
  });

  it('shows a backend change in progress until its release is cut', async () => {
    mockBackends = [{ name: 'primary', weight: 1 }];
    const refetch = jest.fn();
    const ctx = makeCtx({ refetch });
    const pane = (latestRelease: string) => (
      <MemoryRouter>
        <EndpointEnvironmentsProvider value={ctx}>
          <EndpointSetupDetailPane
            firstEnvironment={{ ...dev, latestRelease }}
            onClose={() => {}}
          />
        </EndpointEnvironmentsProvider>
      </MemoryRouter>
    );
    const { rerender } = render(pane('orders-api-abc'));

    fireEvent.click(screen.getByRole('button', { name: 'save change' }));

    // In progress: a loader instead of the release text, Deploy held, and
    // the latest release and the entity are re-read.
    expect(screen.getByRole('status')).toHaveTextContent(
      'New release in progress…',
    );
    expect(screen.getByTestId('backends-section')).toHaveAttribute(
      'data-awaiting',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Deploy' })).toBeDisabled();
    expect(refetch).toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalled();

    // A new release alone isn't enough: the entity must show the change.
    rerender(pane('orders-api-def'));
    expect(screen.getByRole('status')).toBeInTheDocument();

    mockBackends = [
      { name: 'primary', weight: 1 },
      { name: 'canary', weight: 1 },
    ];
    rerender(pane('orders-api-def'));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(
      screen.getByText(/Deploy the latest release, orders-api-def/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deploy' })).toBeEnabled();
  });
});
