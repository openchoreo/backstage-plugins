import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestApiProvider } from '@backstage/test-utils';
import { EditSecretDialog } from './EditSecretDialog';
import { openChoreoClientApiRef, Secret } from '../../api/OpenChoreoClientApi';

const mockClient = {
  getSecret: jest.fn(),
};

function makeSecret(partial: Partial<Secret> = {}): Secret {
  return {
    name: 'db-creds',
    namespace: 'ns',
    secretType: 'Opaque',
    targetPlane: { kind: 'DataPlane', name: 'dp-prod' },
    keys: ['DB_HOST', 'DB_USER'],
    ...partial,
  };
}

function renderDialog(
  overrides: Partial<React.ComponentProps<typeof EditSecretDialog>> = {},
) {
  const defaults: React.ComponentProps<typeof EditSecretDialog> = {
    open: true,
    onClose: jest.fn(),
    onSubmit: jest.fn().mockResolvedValue({} as any),
    secret: makeSecret(),
    namespaceName: 'ns',
  };
  return render(
    <TestApiProvider apis={[[openChoreoClientApiRef, mockClient as any]]}>
      <EditSecretDialog {...defaults} {...overrides} />
    </TestApiProvider>,
  );
}

describe('EditSecretDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.getSecret.mockResolvedValue({
      name: 'db-creds',
      namespace: 'ns',
      secretType: 'Opaque',
      targetPlane: { kind: 'DataPlane', name: 'dp-prod' },
      keys: ['DB_HOST', 'DB_USER'],
      // Base64-encoded values; the dialog decodes at the UI boundary.
      data: { DB_HOST: 'ZGIubG9jYWw=', DB_USER: 'YWxpY2U=' },
    });
  });

  it('renders the title with the secret name and the type/plane meta', async () => {
    renderDialog();
    expect(screen.getByText('Edit Secret: db-creds')).toBeInTheDocument();
    expect(screen.getByText('Opaque')).toBeInTheDocument();
    expect(screen.getByText('dp-prod')).toBeInTheDocument();
    expect(screen.getByText('DataPlane')).toBeInTheDocument();
    // Wait for the async load so the spinner unmounts before the test ends.
    await waitFor(() =>
      expect(
        (screen.getByLabelText('Value 1') as HTMLInputElement).value,
      ).not.toBe(''),
    );
  });

  it('prefills values with decoded plaintext from getSecret', async () => {
    renderDialog();

    await waitFor(() =>
      expect(mockClient.getSecret).toHaveBeenCalledWith('ns', 'db-creds'),
    );

    // Keys are sorted alphabetically: DB_HOST then DB_USER.
    await waitFor(() =>
      expect((screen.getByLabelText('Value 1') as HTMLInputElement).value).toBe(
        'db.local',
      ),
    );
    expect((screen.getByLabelText('Value 2') as HTMLInputElement).value).toBe(
      'alice',
    );
  });

  it('keeps Save disabled until a value changes', async () => {
    const user = userEvent.setup();
    renderDialog();

    // Wait for prefill to land.
    await waitFor(() =>
      expect((screen.getByLabelText('Value 1') as HTMLInputElement).value).toBe(
        'db.local',
      ),
    );

    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();

    // Change a value -> Save enables.
    await user.clear(screen.getByLabelText('Value 1'));
    await user.type(screen.getByLabelText('Value 1'), 'new-host');
    expect(save).toBeEnabled();
  });

  it('Save submits the current key/value map', async () => {
    const onSubmit = jest.fn().mockResolvedValue({} as any);
    const onClose = jest.fn();
    const user = userEvent.setup();
    renderDialog({ onSubmit, onClose });

    await waitFor(() =>
      expect((screen.getByLabelText('Value 1') as HTMLInputElement).value).toBe(
        'db.local',
      ),
    );

    await user.clear(screen.getByLabelText('Value 1'));
    await user.type(screen.getByLabelText('Value 1'), 'new-host');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith('db-creds', {
        data: { DB_HOST: 'new-host', DB_USER: 'alice' },
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('surfaces a load error when getSecret fails', async () => {
    mockClient.getSecret.mockRejectedValueOnce(new Error('boom'));
    renderDialog();

    expect(
      await screen.findByText(/Could not load current values: boom/i),
    ).toBeInTheDocument();
  });

  it('echoes existing labels back on save so categories are not stripped', async () => {
    const existingLabels = {
      'openchoreo.dev/secret-type': 'git-credentials',
    };
    mockClient.getSecret.mockResolvedValueOnce({
      name: 'db-creds',
      namespace: 'ns',
      secretType: 'Opaque',
      targetPlane: { kind: 'DataPlane', name: 'dp-prod' },
      keys: ['DB_HOST', 'DB_USER'],
      labels: existingLabels,
      data: { DB_HOST: 'ZGIubG9jYWw=', DB_USER: 'YWxpY2U=' },
    });

    const onSubmit = jest.fn().mockResolvedValue({} as any);
    const user = userEvent.setup();
    renderDialog({ onSubmit });

    await waitFor(() =>
      expect((screen.getByLabelText('Value 1') as HTMLInputElement).value).toBe(
        'db.local',
      ),
    );

    await user.clear(screen.getByLabelText('Value 1'));
    await user.type(screen.getByLabelText('Value 1'), 'new-host');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith('db-creds', {
        data: { DB_HOST: 'new-host', DB_USER: 'alice' },
        labels: existingLabels,
      }),
    );
  });
});
