import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  CreateSecretDialog,
  type TargetPlaneOption,
} from './CreateSecretDialog';

function renderDialog(
  overrides: Partial<React.ComponentProps<typeof CreateSecretDialog>> = {},
) {
  const defaults: React.ComponentProps<typeof CreateSecretDialog> = {
    open: true,
    onClose: jest.fn(),
    onSubmit: jest.fn().mockResolvedValue({} as any),
    namespaceName: 'ns',
    targetPlanes: [] as TargetPlaneOption[],
    targetPlanesLoading: false,
  };
  return render(<CreateSecretDialog {...defaults} {...overrides} />);
}

// MUI v4 TextField doesn't link <label> via htmlFor, so getByLabelText fails.
// Query by the visible label text rendered inside the wrapping FormControl
// and walk to the input it controls.
function inputForLabel(labelText: string): HTMLElement {
  const labels = screen
    .getAllByText(
      (_, el) =>
        (el?.textContent ?? '').replace(/\s*\*\s*$/, '').trim() === labelText,
    )
    .filter(el => el.tagName === 'LABEL');
  for (const labelEl of labels) {
    const formControl = labelEl.closest('.MuiFormControl-root');
    const input =
      formControl?.querySelector<HTMLElement>('input, textarea') ?? null;
    if (input) return input;
  }
  throw new Error(`No input found near label "${labelText}"`);
}

describe('CreateSecretDialog — target plane error surface', () => {
  it('shows the error message in helper text when targetPlanesError is set', () => {
    renderDialog({ targetPlanesError: new Error('catalog down') });
    expect(
      screen.getByText(/Failed to load target planes: catalog down/i),
    ).toBeInTheDocument();
  });

  it('disables the Create button when targetPlanesError is set', () => {
    renderDialog({ targetPlanesError: new Error('nope') });
    const create = screen.getByRole('button', { name: 'Create' });
    expect(create).toBeDisabled();
  });

  it('uses the default helper text when there is no error', () => {
    renderDialog({
      targetPlanes: [{ kind: 'DataPlane', name: 'dp' }],
    });
    expect(
      screen.getByText('Where this secret will be delivered.'),
    ).toBeInTheDocument();
  });
});

describe('CreateSecretDialog — Create button data validation', () => {
  const planes: TargetPlaneOption[] = [{ kind: 'DataPlane', name: 'dp' }];

  it('keeps Create disabled with a valid name + plane but empty Opaque data', async () => {
    const user = userEvent.setup({ delay: null });
    renderDialog({ targetPlanes: planes });
    await user.type(inputForLabel('Secret Name'), 'my-secret');
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('disables Create for Basic Auth when password is empty', async () => {
    const user = userEvent.setup({ delay: null });
    renderDialog({ targetPlanes: planes });
    await user.type(inputForLabel('Secret Name'), 'basic');
    await user.click(screen.getByRole('radio', { name: /Basic Auth/i }));
    // Username alone is not enough — password is required.
    await user.type(inputForLabel('Username'), 'alice');
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('enables Create for Basic Auth once a password is provided', async () => {
    const user = userEvent.setup({ delay: null });
    renderDialog({ targetPlanes: planes });
    await user.type(inputForLabel('Secret Name'), 'basic');
    await user.click(screen.getByRole('radio', { name: /Basic Auth/i }));
    await user.type(inputForLabel('Password / Token'), 'hunter2');
    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled();
  });

  it('disables Create for Docker Config when JSON is invalid', async () => {
    const user = userEvent.setup({ delay: null });
    renderDialog({ targetPlanes: planes });
    await user.type(inputForLabel('Secret Name'), 'docker');
    await user.click(screen.getByRole('radio', { name: /Docker Config/i }));
    await user.type(inputForLabel('.dockerconfigjson'), 'not-json-{{');
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('disables Create for TLS until both crt and key are provided', async () => {
    const user = userEvent.setup({ delay: null });
    renderDialog({ targetPlanes: planes });
    await user.type(inputForLabel('Secret Name'), 'tls-secret');
    await user.click(screen.getByRole('radio', { name: /^TLS/i }));
    await user.type(inputForLabel('tls.crt'), 'crt-pem');
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
    await user.type(inputForLabel('tls.key'), 'key-pem');
    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled();
  });
});

describe('CreateSecretDialog — Secret Category', () => {
  const planes: TargetPlaneOption[] = [{ kind: 'DataPlane', name: 'dp' }];

  it('defaults to Generic with the general-purpose helper text', () => {
    renderDialog({ targetPlanes: planes });
    expect(screen.getByText('A general-purpose secret.')).toBeInTheDocument();
  });

  it('stamps the generic label when the category is Generic', async () => {
    const user = userEvent.setup({ delay: null });
    const onSubmit = jest.fn().mockResolvedValue({} as any);
    renderDialog({ targetPlanes: planes, onSubmit });

    await user.type(inputForLabel('Secret Name'), 'generic-secret');
    await user.click(screen.getByRole('radio', { name: /Basic Auth/i }));
    await user.type(inputForLabel('Password / Token'), 'hunter2');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].labels).toEqual({
      'openchoreo.dev/secret-type': 'generic',
    });
  });
});

describe('CreateSecretDialog — SSH Auth', () => {
  const planes: TargetPlaneOption[] = [{ kind: 'DataPlane', name: 'dp' }];

  async function selectSshAuth(user: ReturnType<typeof userEvent.setup>) {
    await user.type(inputForLabel('Secret Name'), 'ssh-secret');
    await user.click(screen.getByRole('radio', { name: /SSH Auth/i }));
  }

  // A well-formed key only needs the BEGIN + PRIVATE KEY markers the dialog
  // validates against. userEvent.type into a multiline textarea is slow, so
  // the key value is pasted; short single-line fields still use type.
  const VALID_KEY =
    '-----BEGIN OPENSSH PRIVATE KEY-----abc-----END OPENSSH PRIVATE KEY-----';

  async function pasteSshKey(
    user: ReturnType<typeof userEvent.setup>,
    value: string,
  ) {
    const keyInput = screen.getByLabelText('SSH Private Key');
    keyInput.focus();
    await user.paste(value);
  }

  it('enables Create once a well-formed private key is provided', async () => {
    const user = userEvent.setup({ delay: null });
    renderDialog({ targetPlanes: planes });
    await selectSshAuth(user);
    await pasteSshKey(user, VALID_KEY);
    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled();
  });

  // The two tests below interact with multiple fields (SSH Key ID + multiline
  // SSH key + dynamically-added Key/Value rows). userEvent.setup({ delay: null })
  // types synchronously so they don't blow the timeout under full-suite jsdom
  // load; the extra timeout stays as a safety margin for the slowest CI worker.
  it('submits the SSH key plus the optional SSH Key ID in the data map', async () => {
    const user = userEvent.setup({ delay: null });
    const onSubmit = jest.fn().mockResolvedValue({} as any);
    renderDialog({ targetPlanes: planes, onSubmit });
    await selectSshAuth(user);
    await user.type(screen.getByLabelText('SSH Key ID'), 'my-key-id');
    await pasteSshKey(user, VALID_KEY);
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const { data } = onSubmit.mock.calls[0][0];
    expect(data['ssh-privatekey']).toContain('BEGIN OPENSSH PRIVATE KEY');
    expect(data['ssh-key-id']).toBe('my-key-id');
  }, 15000);

  it('includes an SSH extra key/value row in the submitted data', async () => {
    const user = userEvent.setup({ delay: null });
    const onSubmit = jest.fn().mockResolvedValue({} as any);
    renderDialog({ targetPlanes: planes, onSubmit });
    await selectSshAuth(user);
    await pasteSshKey(user, VALID_KEY);

    // The SSH-auth section renders its own "Add key" button for extra rows.
    await user.click(screen.getByRole('button', { name: 'Add key' }));
    await user.type(screen.getByLabelText('Key 1'), 'known_hosts');
    await user.type(screen.getByLabelText('Value 1'), 'host-entry');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].data.known_hosts).toBe('host-entry');
  }, 15000);
});
