import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectEnvironmentsList } from './ProjectEnvironmentsList';

const mockClient = {
  fetchProjectEnvironmentInfo: jest.fn(),
  updateProjectReleaseBinding: jest.fn(),
};

jest.mock('@backstage/core-plugin-api', () => ({
  useApi: () => mockClient,
  createApiRef: (def: { id: string }) => ({ id: def?.id ?? 'ref' }),
  discoveryApiRef: { id: 'discovery' },
  fetchApiRef: { id: 'fetch' },
}));

const entity = {
  kind: 'System',
  metadata: { name: 'my-app', annotations: {} },
};
jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => ({ entity }),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('@backstage/core-components', () => ({
  Progress: () => <div data-testid="progress">loading</div>,
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
}));

jest.mock('@openchoreo/backstage-design-system', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
}));

jest.mock('../../utils/errorUtils', () => ({
  isForbiddenError: (e: any) => e?.__forbidden === true,
  getErrorMessage: (e: any) => String(e?.message ?? e),
}));

jest.mock('../../hooks', () => ({
  useNotification: () => ({
    notification: null,
    showSuccess: jest.fn(),
    showError: jest.fn(),
  }),
}));

jest.mock('../Environments/components', () => ({
  NotificationBanner: () => null,
}));

jest.mock('../Environments/hooks', () => ({
  useEnvironmentPolling: () => {},
}));

// Canvas stub consumes the context so we can drive selection + promote
// without rendering the real dagre/zoom layer.
jest.mock('./ProjectDeployFlowCanvas', () => ({
  ProjectDeployFlowCanvas: ({
    onSelectEnv,
    onSelectSetup,
    environments,
  }: any) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {
      useProjectEnvironmentsContext,
    } = require('./ProjectEnvironmentsContext');
    const { onPromote } = useProjectEnvironmentsContext();
    return (
      <div data-testid="canvas">
        {environments.map((e: any) => (
          <button key={e.name} onClick={() => onSelectEnv(e.name)}>
            select-{e.name}
          </button>
        ))}
        <button onClick={onSelectSetup}>select-setup</button>
        <button onClick={() => onPromote('staging', 'rel-x')}>promote</button>
      </div>
    );
  },
}));

jest.mock('./ProjectEnvironmentDetailPanel', () => ({
  ProjectEnvironmentDetailPanel: ({ env }: any) => (
    <div data-testid="detail">{env ? env.name : 'none'}</div>
  ),
}));

jest.mock('./ProjectSetupDetailPane', () => ({
  ProjectSetupDetailPane: ({ onConfigureDeploy }: any) => (
    <button onClick={onConfigureDeploy}>configure-deploy</button>
  ),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.updateProjectReleaseBinding.mockResolvedValue({ ok: true });
});

describe('ProjectEnvironmentsList', () => {
  it('renders the canvas + empty detail panel after a successful load', async () => {
    mockClient.fetchProjectEnvironmentInfo.mockResolvedValue([
      { name: 'dev' },
      { name: 'staging' },
    ]);

    render(<ProjectEnvironmentsList />);

    expect(await screen.findByTestId('canvas')).toBeInTheDocument();
    expect(screen.getByTestId('detail').textContent).toBe('none');
  });

  it('selects an environment and shows it in the detail panel', async () => {
    mockClient.fetchProjectEnvironmentInfo.mockResolvedValue([{ name: 'dev' }]);
    render(<ProjectEnvironmentsList />);

    fireEvent.click(await screen.findByText('select-dev'));
    expect(screen.getByTestId('detail').textContent).toBe('dev');
  });

  it('navigates to the parameters wizard from the setup pane', async () => {
    mockClient.fetchProjectEnvironmentInfo.mockResolvedValue([{ name: 'dev' }]);
    render(<ProjectEnvironmentsList />);

    fireEvent.click(await screen.findByText('select-setup'));
    fireEvent.click(screen.getByText('configure-deploy'));
    expect(mockNavigate).toHaveBeenCalledWith('parameters-config');
  });

  it('promotes through the context handler', async () => {
    mockClient.fetchProjectEnvironmentInfo.mockResolvedValue([{ name: 'dev' }]);
    render(<ProjectEnvironmentsList />);

    fireEvent.click(await screen.findByText('promote'));
    await waitFor(() =>
      expect(mockClient.updateProjectReleaseBinding).toHaveBeenCalledWith(
        entity,
        'staging',
        { projectRelease: 'rel-x' },
      ),
    );
  });

  it('shows an empty-state when the pipeline has no environments', async () => {
    mockClient.fetchProjectEnvironmentInfo.mockResolvedValue([]);
    render(<ProjectEnvironmentsList />);
    expect(
      await screen.findByText(/no environments configured/i),
    ).toBeInTheDocument();
  });

  it('shows an error message when the load fails', async () => {
    mockClient.fetchProjectEnvironmentInfo.mockRejectedValue(new Error('boom'));
    render(<ProjectEnvironmentsList />);
    expect(
      await screen.findByText(/failed to load environments/i),
    ).toBeInTheDocument();
  });

  it('renders the ForbiddenState on a forbidden load', async () => {
    mockClient.fetchProjectEnvironmentInfo.mockRejectedValue(
      Object.assign(new Error('forbidden'), { __forbidden: true }),
    );
    render(<ProjectEnvironmentsList />);
    expect(await screen.findByTestId('forbidden')).toBeInTheDocument();
  });
});
