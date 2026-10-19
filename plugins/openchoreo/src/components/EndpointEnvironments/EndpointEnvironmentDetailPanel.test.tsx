import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { EndpointEnvironment } from '../../api/OpenChoreoClientApi';
import { EndpointEnvironmentDetailPanel } from './EndpointEnvironmentDetailPanel';
import { EndpointSetupDetailPane } from './EndpointSetup';
import {
  EndpointEnvironmentsProvider,
  type EndpointEnvironmentsContextValue,
} from './EndpointEnvironmentsContext';

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

    fireEvent.click(
      screen.getByRole('button', { name: 'Deploy to Production' }),
    );

    expect(onPromote).toHaveBeenCalledWith('production', 'orders-api-def');
  });

  it('is disabled when the first environment already runs the latest release', () => {
    renderWithCtx(
      <EndpointSetupDetailPane firstEnvironment={dev} onClose={() => {}} />,
    );

    expect(
      screen.getByRole('button', { name: 'Deploy to Development' }),
    ).toBeDisabled();
    expect(
      screen.getByText(/already runs the latest release/i),
    ).toBeInTheDocument();
  });

  it('is disabled until the endpoint has a release', () => {
    renderWithCtx(
      <EndpointSetupDetailPane firstEnvironment={prod} onClose={() => {}} />,
    );

    expect(
      screen.getByRole('button', { name: 'Deploy to Production' }),
    ).toBeDisabled();
    expect(screen.getByText(/has no release yet/i)).toBeInTheDocument();
  });
});
