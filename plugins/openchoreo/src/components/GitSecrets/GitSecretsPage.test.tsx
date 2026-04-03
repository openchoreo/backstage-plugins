import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestApiProvider } from '@backstage/test-utils';
import { createMockOpenChoreoClient } from '@openchoreo/test-utils';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { GitSecretsContent } from './GitSecretsPage';

// ---- Mocks ----

jest.mock('@backstage/core-components', () => ({
  Page: ({ children }: any) => <div>{children}</div>,
  Header: () => null,
  Content: ({ children }: any) => <div>{children}</div>,
  WarningPanel: ({ title, children }: any) => (
    <div data-testid="warning-panel" data-title={title}>
      {children}
    </div>
  ),
}));

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  ForbiddenState: ({ message, onRetry }: any) => (
    <div data-testid="forbidden-state">
      {message}
      {onRetry && <button onClick={onRetry}>Retry</button>}
    </div>
  ),
}));

const mockUseGitSecrets = jest.fn();
jest.mock('./hooks/useGitSecrets', () => ({
  useGitSecrets: (ns: string) => mockUseGitSecrets(ns),
}));

jest.mock('./SecretsTable', () => ({
  SecretsTable: ({ secrets, loading, onDelete, namespaceName }: any) => (
    <div data-testid="secrets-table">
      <span data-testid="table-namespace">{namespaceName}</span>
      <span data-testid="table-loading">{String(loading)}</span>
      {secrets.map((s: any) => (
        <div key={s.name} data-testid={`secret-${s.name}`}>
          {s.name}
          <button onClick={() => onDelete(s.name)}>Delete</button>
        </div>
      ))}
    </div>
  ),
}));

jest.mock('./CreateSecretDialog', () => ({
  CreateSecretDialog: ({ open, onClose, onSubmit }: any) =>
    open ? (
      <div data-testid="create-dialog">
        <button
          onClick={() => onSubmit('new-secret', 'basic-auth', 'token123')}
          data-testid="dialog-submit"
        >
          Submit
        </button>
        <button onClick={onClose} data-testid="dialog-close">
          Close
        </button>
      </div>
    ) : null,
}));

// ---- Helpers ----

const mockClient = createMockOpenChoreoClient();
const mockCatalogApi = {
  getEntities: jest.fn(),
};

const defaultSecretsHook = {
  secrets: [],
  loading: false,
  error: null,
  isForbidden: false,
  createSecret: jest.fn(),
  deleteSecret: jest.fn(),
  fetchSecrets: jest.fn(),
};

function renderContent() {
  return render(
    <TestApiProvider
      apis={[
        [openChoreoClientApiRef, mockClient],
        [catalogApiRef, mockCatalogApi],
      ]}
    >
      <GitSecretsContent />
    </TestApiProvider>,
  );
}

// ---- Tests ----

describe('GitSecretsContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.listNamespaces.mockResolvedValue([
      { name: 'alpha-ns', displayName: 'Alpha' },
      { name: 'beta-ns', displayName: 'Beta' },
    ]);
    mockCatalogApi.getEntities.mockResolvedValue({ items: [] });
    mockUseGitSecrets.mockReturnValue(defaultSecretsHook);
  });

  it('shows "Select a namespace" prompt initially before namespaces load', () => {
    mockClient.listNamespaces.mockReturnValue(new Promise(() => {})); // never resolves

    renderContent();

    expect(
      screen.getByText('Select a namespace to manage git secrets'),
    ).toBeInTheDocument();
  });

  it('auto-selects first namespace after loading', async () => {
    renderContent();

    await waitFor(() => {
      expect(mockUseGitSecrets).toHaveBeenCalledWith('alpha-ns');
    });
  });

  it('renders namespace selector', async () => {
    renderContent();

    await waitFor(() => {
      expect(screen.getByLabelText('Namespace')).toBeInTheDocument();
    });
  });

  it('shows secrets table when namespace is selected', async () => {
    mockUseGitSecrets.mockReturnValue({
      ...defaultSecretsHook,
      secrets: [{ name: 'my-secret' }],
    });

    renderContent();

    await waitFor(() => {
      expect(screen.getByTestId('secrets-table')).toBeInTheDocument();
    });
    expect(screen.getByTestId('secret-my-secret')).toBeInTheDocument();
  });

  it('shows forbidden state when secrets access is forbidden', async () => {
    mockUseGitSecrets.mockReturnValue({
      ...defaultSecretsHook,
      error: new Error('403 Forbidden'),
      isForbidden: true,
    });

    renderContent();

    await waitFor(() => {
      expect(screen.getByTestId('forbidden-state')).toBeInTheDocument();
    });
    expect(
      screen.getByText('You do not have permission to view git secrets.'),
    ).toBeInTheDocument();
  });

  it('shows error warning for non-forbidden secrets errors', async () => {
    mockUseGitSecrets.mockReturnValue({
      ...defaultSecretsHook,
      error: new Error('Network failure'),
      isForbidden: false,
    });

    renderContent();

    await waitFor(() => {
      expect(screen.getByText('Network failure')).toBeInTheDocument();
    });
  });

  it('shows namespace loading error', async () => {
    mockClient.listNamespaces.mockRejectedValue(
      new Error('Failed to fetch namespaces'),
    );

    renderContent();

    await waitFor(() => {
      expect(
        screen.getByText('Failed to fetch namespaces'),
      ).toBeInTheDocument();
    });
  });

  it('disables Create Secret button when no namespace selected', () => {
    mockClient.listNamespaces.mockReturnValue(new Promise(() => {}));

    renderContent();

    expect(
      screen.getByRole('button', { name: /create secret/i }),
    ).toBeDisabled();
  });

  it('enables Create Secret button when namespace is selected', async () => {
    renderContent();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /create secret/i }),
      ).toBeEnabled();
    });
  });

  it('opens create dialog when Create Secret is clicked', async () => {
    const user = userEvent.setup();

    renderContent();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /create secret/i }),
      ).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: /create secret/i }));

    expect(screen.getByTestId('create-dialog')).toBeInTheDocument();
  });

  it('disables Refresh button when no namespace selected', () => {
    mockClient.listNamespaces.mockReturnValue(new Promise(() => {}));

    renderContent();

    expect(screen.getByTitle('Refresh')).toBeDisabled();
  });
});
