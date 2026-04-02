import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SecretsTable } from './SecretsTable';
import { GitSecret } from '../../api/OpenChoreoClientApi';

// ---- Helpers ----

const secrets: GitSecret[] = [
  { name: 'repo-token', namespace: 'test-ns', workflowPlaneName: 'default-plane', workflowPlaneKind: 'WorkflowPlane' },
  { name: 'deploy-key', namespace: 'test-ns', workflowPlaneName: 'shared-plane', workflowPlaneKind: 'ClusterWorkflowPlane' },
];

function renderTable(
  overrides: Partial<React.ComponentProps<typeof SecretsTable>> = {},
) {
  const defaultProps = {
    secrets,
    loading: false,
    onDelete: jest.fn().mockResolvedValue(undefined),
    namespaceName: 'test-ns',
  };

  return {
    ...render(<SecretsTable {...defaultProps} {...overrides} />),
    props: { ...defaultProps, ...overrides },
  };
}

// ---- Tests ----

describe('SecretsTable', () => {
  it('shows progress bar when loading', () => {
    renderTable({ loading: true });

    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('shows empty state when no secrets', () => {
    renderTable({ secrets: [] });

    expect(screen.getByText('No git secrets in test-ns')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Create a git secret to access private repositories during builds.',
      ),
    ).toBeInTheDocument();
  });

  it('renders secret names in the table', () => {
    renderTable();

    expect(screen.getByText('repo-token')).toBeInTheDocument();
    expect(screen.getByText('deploy-key')).toBeInTheDocument();
  });

  it('renders workflow plane names', () => {
    renderTable();

    expect(screen.getByText('default-plane')).toBeInTheDocument();
    expect(screen.getByText('shared-plane')).toBeInTheDocument();
  });

  it('shows Cluster chip for ClusterWorkflowPlane secrets', () => {
    renderTable();

    expect(screen.getByText('Cluster')).toBeInTheDocument();
  });

  it('shows search field when secrets exist', () => {
    renderTable();

    expect(
      screen.getByLabelText('Search secrets'),
    ).toBeInTheDocument();
  });

  it('does not show search field when no secrets', () => {
    renderTable({ secrets: [] });

    expect(
      screen.queryByLabelText('Search secrets'),
    ).not.toBeInTheDocument();
  });

  it('filters secrets by search query', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.type(screen.getByLabelText('Search secrets'), 'repo');

    expect(screen.getByText('repo-token')).toBeInTheDocument();
    expect(screen.queryByText('deploy-key')).not.toBeInTheDocument();
  });

  it('shows no match message when search has no results', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.type(screen.getByLabelText('Search secrets'), 'nonexistent');

    expect(
      screen.getByText('No secrets match your search'),
    ).toBeInTheDocument();
  });

  it('opens delete confirmation dialog when delete icon is clicked', async () => {
    const user = userEvent.setup();
    renderTable();

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    expect(screen.getByText('Delete Git Secret')).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to delete the git secret/),
    ).toBeInTheDocument();
    // "repo-token" appears both in the table row and the dialog's <strong> tag
    expect(screen.getAllByText('repo-token').length).toBeGreaterThanOrEqual(2);
  });

  it('calls onDelete and closes dialog on confirm', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn().mockResolvedValue(undefined);
    renderTable({ onDelete });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('repo-token');
    });

    await waitFor(() => {
      expect(
        screen.queryByText('Delete Git Secret'),
      ).not.toBeInTheDocument();
    });
  });

  it('shows error when delete fails', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn().mockRejectedValue(new Error('Delete failed'));
    renderTable({ onDelete });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.getByText('Delete failed')).toBeInTheDocument();
    });
  });

  it('closes delete dialog on cancel', async () => {
    const user = userEvent.setup();
    renderTable();

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    expect(screen.getByText('Delete Git Secret')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(
        screen.queryByText('Delete Git Secret'),
      ).not.toBeInTheDocument();
    });
  });

  it('shows "Deleting..." and disables buttons during deletion', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn().mockReturnValue(new Promise(() => {})); // never resolves
    renderTable({ onDelete });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(
      screen.getByRole('button', { name: /deleting/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /cancel/i }),
    ).toBeDisabled();
  });

  it('renders table headers', () => {
    renderTable();

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Workflow Plane')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });
});
