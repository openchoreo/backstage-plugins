import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestApiProvider } from '@backstage/test-utils';
import { createMockOpenChoreoClient } from '@openchoreo/test-utils';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { ClusterRolesContent } from './ClusterRolesContent';

// ---- Mocks ----

const mockUseClusterRolePermissions = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useClusterRolePermissions: () => mockUseClusterRolePermissions(),
  ForbiddenState: ({ message, onRetry }: any) => (
    <div data-testid="forbidden-state">
      {message}
      {onRetry && (
        <button onClick={onRetry} data-testid="retry-button">
          Retry
        </button>
      )}
    </div>
  ),
}));

jest.mock('../../../utils/errorUtils', () => ({
  isForbiddenError: (err: any) => err?.message?.includes('403'),
}));

const mockFetchRoles = jest.fn();
const mockAddRole = jest.fn();
const mockUpdateRole = jest.fn();
const mockDeleteRole = jest.fn();
const mockUseClusterRoles = jest.fn();

jest.mock('../hooks', () => ({
  useClusterRoles: () => mockUseClusterRoles(),
}));

jest.mock('../../../hooks', () => ({
  useNotification: () => ({
    notification: null,
    showSuccess: jest.fn(),
    showError: jest.fn(),
  }),
}));

jest.mock('../../Environments/components', () => ({
  NotificationBanner: () => null,
}));

jest.mock('@backstage/core-components', () => ({
  Progress: () => <div data-testid="progress">Loading...</div>,
  ResponseErrorPanel: ({ error }: any) => (
    <div data-testid="error-panel">{error.message}</div>
  ),
}));

jest.mock('./RolesTable', () => ({
  RolesTable: ({ roles, onEdit, onDelete }: any) => (
    <div data-testid="roles-table">
      {roles.map((r: any) => (
        <div key={r.name} data-testid={`role-${r.name}`}>
          {r.name}
          <button onClick={() => onEdit(r)} data-testid={`edit-${r.name}`}>
            Edit
          </button>
          <button
            onClick={() => onDelete(r.name)}
            data-testid={`delete-${r.name}`}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  ),
}));

jest.mock('./RoleDialog', () => ({
  RoleDialog: ({ open, onClose, onSave, editingRole }: any) =>
    open ? (
      <div data-testid="role-dialog">
        <span data-testid="dialog-mode">{editingRole ? 'edit' : 'create'}</span>
        <button
          onClick={() =>
            onSave({ name: editingRole?.name ?? 'new-role', actions: [] })
          }
          data-testid="dialog-save"
        >
          Save
        </button>
        <button onClick={onClose} data-testid="dialog-close">
          Close
        </button>
      </div>
    ) : null,
}));

// ---- Helpers ----

const mockClient = createMockOpenChoreoClient();

const grantedPermissions = {
  canView: true,
  canCreate: true,
  canUpdate: true,
  canDelete: true,
  loading: false,
  createDeniedTooltip: '',
  updateDeniedTooltip: '',
  deleteDeniedTooltip: '',
};

function createActionsRef() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return { current: container };
}

function renderContent(actionsRef?: React.RefObject<HTMLDivElement>) {
  const ref = actionsRef ?? createActionsRef();
  return render(
    <TestApiProvider apis={[[openChoreoClientApiRef, mockClient]]}>
      <ClusterRolesContent actionsContainerRef={ref as any} />
    </TestApiProvider>,
  );
}

// ---- Tests ----

describe('ClusterRolesContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseClusterRolePermissions.mockReturnValue(grantedPermissions);
    mockUseClusterRoles.mockReturnValue({
      roles: [{ name: 'admin', actions: ['read', 'write'] }],
      loading: false,
      error: null,
      fetchRoles: mockFetchRoles,
      addRole: mockAddRole,
      updateRole: mockUpdateRole,
      deleteRole: mockDeleteRole,
    });
  });

  it('shows progress when loading', () => {
    mockUseClusterRoles.mockReturnValue({
      roles: [],
      loading: true,
      error: null,
      fetchRoles: mockFetchRoles,
      addRole: mockAddRole,
      updateRole: mockUpdateRole,
      deleteRole: mockDeleteRole,
    });

    renderContent();

    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('shows progress when permissions are loading', () => {
    mockUseClusterRolePermissions.mockReturnValue({
      ...grantedPermissions,
      loading: true,
    });

    renderContent();

    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('shows forbidden state for 403 error', () => {
    mockUseClusterRoles.mockReturnValue({
      roles: [],
      loading: false,
      error: new Error('403 Forbidden'),
      fetchRoles: mockFetchRoles,
      addRole: mockAddRole,
      updateRole: mockUpdateRole,
      deleteRole: mockDeleteRole,
    });

    renderContent();

    expect(screen.getByTestId('forbidden-state')).toBeInTheDocument();
    expect(
      screen.getByText('You do not have permission to view cluster roles.'),
    ).toBeInTheDocument();
  });

  it('shows error panel for non-forbidden errors', () => {
    mockUseClusterRoles.mockReturnValue({
      roles: [],
      loading: false,
      error: new Error('Network error'),
      fetchRoles: mockFetchRoles,
      addRole: mockAddRole,
      updateRole: mockUpdateRole,
      deleteRole: mockDeleteRole,
    });

    renderContent();

    expect(screen.getByTestId('error-panel')).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('shows forbidden state when canView is false', () => {
    mockUseClusterRolePermissions.mockReturnValue({
      ...grantedPermissions,
      canView: false,
    });

    renderContent();

    expect(screen.getByTestId('forbidden-state')).toBeInTheDocument();
  });

  it('renders roles table with roles when loaded', () => {
    renderContent();

    expect(screen.getByTestId('roles-table')).toBeInTheDocument();
    expect(screen.getByTestId('role-admin')).toBeInTheDocument();
  });

  it('renders New Cluster Role button in actions portal', () => {
    renderContent();

    expect(
      screen.getByRole('button', { name: /new cluster role/i }),
    ).toBeInTheDocument();
  });

  it('disables create button when canCreate is false', () => {
    mockUseClusterRolePermissions.mockReturnValue({
      ...grantedPermissions,
      canCreate: false,
    });

    renderContent();

    expect(
      screen.getByRole('button', { name: /new cluster role/i }),
    ).toBeDisabled();
  });

  it('opens create dialog when New Cluster Role is clicked', async () => {
    const user = userEvent.setup();

    renderContent();

    await user.click(screen.getByRole('button', { name: /new cluster role/i }));

    expect(screen.getByTestId('role-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-mode')).toHaveTextContent('create');
  });

  it('opens edit dialog when edit is clicked on a role', async () => {
    const user = userEvent.setup();

    renderContent();

    await user.click(screen.getByTestId('edit-admin'));

    expect(screen.getByTestId('role-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-mode')).toHaveTextContent('edit');
  });

  it('calls deleteRole when delete is clicked on a role', async () => {
    const user = userEvent.setup();

    renderContent();

    await user.click(screen.getByTestId('delete-admin'));

    await waitFor(() => {
      expect(mockDeleteRole).toHaveBeenCalledWith('admin');
    });
  });

  it('renders refresh button in actions portal', () => {
    renderContent();

    expect(screen.getByTitle('Refresh')).toBeInTheDocument();
  });
});
