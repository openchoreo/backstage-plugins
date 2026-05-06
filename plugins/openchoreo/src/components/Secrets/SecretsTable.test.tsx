import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SecretsTable } from './SecretsTable';
import { Secret } from '../../api/OpenChoreoClientApi';

const secrets: Secret[] = [
  {
    name: 'db-creds',
    namespace: 'test-ns',
    secretType: 'Opaque',
    targetPlane: { kind: 'DataPlane', name: 'dp-prod' },
    keys: ['DB_HOST', 'DB_PASSWORD', 'DB_USER'],
  },
  {
    name: 'registry-pull',
    namespace: 'test-ns',
    secretType: 'kubernetes.io/dockerconfigjson',
    targetPlane: { kind: 'ClusterDataPlane', name: 'shared-cdp' },
    keys: ['.dockerconfigjson'],
  },
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

describe('SecretsTable', () => {
  it('shows progress bar when loading', () => {
    renderTable({ loading: true });
    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('shows empty state when no secrets', () => {
    renderTable({ secrets: [] });
    expect(screen.getByText('No secrets in test-ns')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Create a secret to deliver credentials to your workloads.',
      ),
    ).toBeInTheDocument();
  });

  it('renders secret names, types, and target planes', () => {
    renderTable();
    expect(screen.getByText('db-creds')).toBeInTheDocument();
    expect(screen.getByText('registry-pull')).toBeInTheDocument();
    expect(screen.getByText('Opaque')).toBeInTheDocument();
    expect(screen.getByText('Docker Config')).toBeInTheDocument();
    expect(screen.getByText('dp-prod')).toBeInTheDocument();
    expect(screen.getByText('shared-cdp')).toBeInTheDocument();
    expect(screen.getByText('DataPlane')).toBeInTheDocument();
    expect(screen.getByText('ClusterDataPlane')).toBeInTheDocument();
  });

  it('shows search field when secrets exist', () => {
    renderTable();
    expect(screen.getByLabelText('Search secrets')).toBeInTheDocument();
  });

  it('filters secrets by search query', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.type(screen.getByLabelText('Search secrets'), 'registry');

    expect(screen.getByText('registry-pull')).toBeInTheDocument();
    expect(screen.queryByText('db-creds')).not.toBeInTheDocument();
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

    expect(screen.getByText('Delete Secret')).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to delete the secret/),
    ).toBeInTheDocument();
    expect(screen.getAllByText('db-creds').length).toBeGreaterThanOrEqual(2);
  });

  it('calls onDelete and closes dialog on confirm', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn().mockResolvedValue(undefined);
    renderTable({ onDelete });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('db-creds');
    });

    await waitFor(() => {
      expect(screen.queryByText('Delete Secret')).not.toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByText('Delete Secret')).not.toBeInTheDocument();
    });
  });

  it('renders table headers', () => {
    renderTable();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Target Plane')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.queryByText('Keys')).not.toBeInTheDocument();
  });
});
