import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TestApiProvider } from '@backstage/test-utils';
import { alertApiRef } from '@backstage/core-plugin-api';
import { createMockOpenChoreoClient } from '@openchoreo/test-utils';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import {
  useDeleteEntityMenuItems,
  type DeletePermissionInfo,
} from './useDeleteEntityMenuItems';
import type { Entity } from '@backstage/catalog-model';

// ---- Mocks ----

jest.mock('../utils', () => ({
  isMarkedForDeletion: jest.fn().mockReturnValue(false),
}));

jest.mock('../../ResourceDefinition/utils', () => ({
  isSupportedKind: (kind: string) =>
    ['componenttype', 'traittype', 'workflow'].includes(kind),
  mapKindToApiKind: (kind: string) => kind,
}));

jest.mock('../../../utils/errorUtils', () => ({
  isForbiddenError: (err: any) => err?.message?.includes('403'),
  getErrorMessage: (err: any) =>
    err instanceof Error ? err.message : String(err),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// ---- Helpers ----

const mockClient = createMockOpenChoreoClient();
const mockAlertApi = { post: jest.fn() };

function makeEntity(kind: string, name: string): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind,
    metadata: {
      name,
      namespace: 'default',
      annotations: {
        'openchoreo.io/namespace': 'test-ns',
      },
    },
    spec: {},
  };
}

/**
 * Wrapper component that renders the hook's menu item and dialog.
 */
function TestHarness({
  entity,
  deletePermission,
}: {
  entity: Entity;
  deletePermission?: DeletePermissionInfo;
}) {
  const { extraMenuItems, DeleteConfirmationDialog } =
    useDeleteEntityMenuItems(entity, deletePermission);

  return (
    <div>
      {extraMenuItems.map(item => (
        <button
          key={item.title}
          onClick={item.onClick}
          disabled={item.disabled}
          title={item.tooltip}
          data-testid="menu-item"
        >
          {item.title}
        </button>
      ))}
      {extraMenuItems.length === 0 && (
        <span data-testid="no-menu-items">No items</span>
      )}
      <DeleteConfirmationDialog />
    </div>
  );
}

function renderHarness(
  entity: Entity,
  deletePermission?: DeletePermissionInfo,
) {
  return render(
    <MemoryRouter>
      <TestApiProvider
        apis={[
          [openChoreoClientApiRef, mockClient],
          [alertApiRef, mockAlertApi],
        ]}
      >
        <TestHarness entity={entity} deletePermission={deletePermission} />
      </TestApiProvider>
    </MemoryRouter>,
  );
}

// ---- Tests ----

describe('useDeleteEntityMenuItems', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset isMarkedForDeletion since clearAllMocks doesn't reset mockReturnValue
    const { isMarkedForDeletion } = require('../utils');
    isMarkedForDeletion.mockReturnValue(false);
  });

  it('returns "Delete Component" for Component entity', () => {
    renderHarness(makeEntity('Component', 'my-service'));

    expect(screen.getByTestId('menu-item')).toHaveTextContent('Delete Component');
  });

  it('returns "Delete Project" for System entity', () => {
    renderHarness(makeEntity('System', 'my-project'));

    expect(screen.getByTestId('menu-item')).toHaveTextContent('Delete Project');
  });

  it('returns "Delete Namespace" for Domain entity', () => {
    renderHarness(makeEntity('Domain', 'my-ns'));

    expect(screen.getByTestId('menu-item')).toHaveTextContent('Delete Namespace');
  });

  it('returns empty items for unsupported entity kind', () => {
    renderHarness(makeEntity('API', 'my-api'));

    expect(screen.getByTestId('no-menu-items')).toBeInTheDocument();
  });

  it('returns empty items when already marked for deletion', () => {
    const { isMarkedForDeletion } = require('../utils');
    isMarkedForDeletion.mockReturnValue(true);

    renderHarness(makeEntity('Component', 'deleting-service'));

    expect(screen.getByTestId('no-menu-items')).toBeInTheDocument();
  });

  it('returns empty items when deletePermission is loading', () => {
    renderHarness(makeEntity('Component', 'my-service'), {
      canDelete: false,
      loading: true,
      deniedTooltip: '',
    });

    expect(screen.getByTestId('no-menu-items')).toBeInTheDocument();
  });

  it('returns disabled item with tooltip when permission denied', () => {
    renderHarness(makeEntity('Component', 'my-service'), {
      canDelete: false,
      loading: false,
      deniedTooltip: 'No delete permission',
    });

    const item = screen.getByTestId('menu-item');
    expect(item).toBeDisabled();
    expect(item).toHaveAttribute('title', 'No delete permission');
  });

  it('opens confirmation dialog when menu item is clicked', async () => {
    const user = userEvent.setup();

    renderHarness(makeEntity('Component', 'my-service'));

    await user.click(screen.getByTestId('menu-item'));

    // Dialog title is inside an h4
    expect(screen.getByRole('heading', { name: /delete component/i })).toBeInTheDocument();
    expect(screen.getByText(/my-service/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('shows cascade warning for project deletion', async () => {
    const user = userEvent.setup();

    renderHarness(makeEntity('System', 'my-project'));

    await user.click(screen.getByTestId('menu-item'));

    expect(
      screen.getByText(/All components within this project will also be deleted/),
    ).toBeInTheDocument();
  });

  it('shows cascade warning for namespace deletion', async () => {
    const user = userEvent.setup();

    renderHarness(makeEntity('Domain', 'my-ns'));

    await user.click(screen.getByTestId('menu-item'));

    expect(
      screen.getByText(/All projects and components within this namespace/),
    ).toBeInTheDocument();
  });

  it('calls deleteComponent on confirm and navigates to /catalog', async () => {
    const user = userEvent.setup();
    mockClient.deleteComponent.mockResolvedValue(undefined);

    renderHarness(makeEntity('Component', 'my-service'));

    await user.click(screen.getByTestId('menu-item'));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(mockClient.deleteComponent).toHaveBeenCalled();
    });
    expect(mockAlertApi.post).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Component "my-service" has been marked for deletion',
        severity: 'success',
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/catalog');
  });

  it('calls deleteProject on confirm for System entity', async () => {
    const user = userEvent.setup();
    mockClient.deleteProject.mockResolvedValue(undefined);

    renderHarness(makeEntity('System', 'my-project'));

    await user.click(screen.getByTestId('menu-item'));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(mockClient.deleteProject).toHaveBeenCalled();
    });
  });

  it('shows permission error when delete returns 403', async () => {
    const user = userEvent.setup();
    mockClient.deleteComponent.mockRejectedValue(new Error('403 Forbidden'));

    renderHarness(makeEntity('Component', 'my-service'));

    await user.click(screen.getByTestId('menu-item'));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/You do not have permission to delete this resource/),
      ).toBeInTheDocument();
    });
  });

  it('shows error message when delete fails with non-403 error', async () => {
    const user = userEvent.setup();
    mockClient.deleteComponent.mockRejectedValue(new Error('Network timeout'));

    renderHarness(makeEntity('Component', 'my-service'));

    await user.click(screen.getByTestId('menu-item'));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Network timeout/)).toBeInTheDocument();
    });
  });

  it('closes dialog on cancel without API call', async () => {
    const user = userEvent.setup();

    renderHarness(makeEntity('Component', 'my-service'));

    await user.click(screen.getByTestId('menu-item'));
    expect(screen.getByRole('heading', { name: /delete component/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /delete component/i })).not.toBeInTheDocument();
    });
    expect(mockClient.deleteComponent).not.toHaveBeenCalled();
  });
});
