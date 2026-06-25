import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TestApiProvider } from '@backstage/test-utils';
import { alertApiRef } from '@backstage/core-plugin-api';
import { createMockOpenChoreoClient } from '@openchoreo/test-utils';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { useDeleteComponentDialog } from './useDeleteComponentDialog';
import type { Entity } from '@backstage/catalog-model';

// ---- Mocks ----

jest.mock('../../../utils/errorUtils', () => ({
  isForbiddenError: (err: any) => err?.message?.includes('403'),
  getErrorMessage: (err: any) =>
    err instanceof Error ? err.message : String(err),
}));

// ---- Helpers ----

const mockClient = createMockOpenChoreoClient();
const mockAlertApi = { post: jest.fn() };

function makeComponent(name: string): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name,
      namespace: 'default',
      annotations: { 'openchoreo.io/namespace': 'test-ns' },
    },
    spec: {},
  };
}

/** Renders the hook: a button per entity opens the shared dialog. */
function TestHarness({
  entities,
  onDeleted,
}: {
  entities: Entity[];
  onDeleted?: () => void;
}) {
  const { requestDelete, DeleteDialog } = useDeleteComponentDialog({
    onDeleted,
  });

  return (
    <div>
      {entities.map(entity => (
        <button
          key={entity.metadata.name}
          data-testid={`open-${entity.metadata.name}`}
          onClick={() => requestDelete(entity)}
        >
          open
        </button>
      ))}
      <DeleteDialog />
    </div>
  );
}

function renderHarness(entities: Entity[], onDeleted?: () => void) {
  return render(
    <MemoryRouter>
      <TestApiProvider
        apis={[
          [openChoreoClientApiRef, mockClient],
          [alertApiRef, mockAlertApi],
        ]}
      >
        <TestHarness entities={entities} onDeleted={onDeleted} />
      </TestApiProvider>
    </MemoryRouter>,
  );
}

// ---- Tests ----

describe('useDeleteComponentDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('dialog stays closed until a delete is requested', () => {
    renderHarness([makeComponent('my-service')]);

    expect(
      screen.queryByRole('heading', { name: /delete component/i }),
    ).not.toBeInTheDocument();
  });

  it('opens the confirmation dialog for the requested component', async () => {
    const user = userEvent.setup();
    renderHarness([makeComponent('my-service')]);

    await user.click(screen.getByTestId('open-my-service'));

    expect(
      screen.getByRole('heading', { name: /delete component/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/my-service/)).toBeInTheDocument();
  });

  it('deletes the component, alerts success and calls onDeleted', async () => {
    const user = userEvent.setup();
    const onDeleted = jest.fn();
    mockClient.deleteComponent.mockResolvedValue(undefined);

    renderHarness([makeComponent('my-service')], onDeleted);

    await user.click(screen.getByTestId('open-my-service'));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(mockClient.deleteComponent).toHaveBeenCalledTimes(1);
      expect(mockAlertApi.post).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Component "my-service" has been marked for deletion',
          severity: 'success',
        }),
      );
      expect(onDeleted).toHaveBeenCalledTimes(1);
    });
    // Dialog closes on success.
    expect(
      screen.queryByRole('heading', { name: /delete component/i }),
    ).not.toBeInTheDocument();
  });

  it('targets the component whose row requested deletion', async () => {
    const user = userEvent.setup();
    mockClient.deleteComponent.mockResolvedValue(undefined);

    renderHarness([makeComponent('svc-a'), makeComponent('svc-b')]);

    await user.click(screen.getByTestId('open-svc-b'));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(mockClient.deleteComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ name: 'svc-b' }),
        }),
      );
    });
  });

  it('shows a permission error on 403 and does not call onDeleted', async () => {
    const user = userEvent.setup();
    const onDeleted = jest.fn();
    mockClient.deleteComponent.mockRejectedValue(new Error('403 Forbidden'));

    renderHarness([makeComponent('my-service')], onDeleted);

    await user.click(screen.getByTestId('open-my-service'));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/You do not have permission to delete this component/),
      ).toBeInTheDocument();
    });
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('shows a generic error on non-403 failure', async () => {
    const user = userEvent.setup();
    mockClient.deleteComponent.mockRejectedValue(new Error('Network timeout'));

    renderHarness([makeComponent('my-service')]);

    await user.click(screen.getByTestId('open-my-service'));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Network timeout/)).toBeInTheDocument();
    });
  });

  it('closes on cancel without calling the API', async () => {
    const user = userEvent.setup();
    renderHarness([makeComponent('my-service')]);

    await user.click(screen.getByTestId('open-my-service'));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: /delete component/i }),
      ).not.toBeInTheDocument();
    });
    expect(mockClient.deleteComponent).not.toHaveBeenCalled();
  });
});
