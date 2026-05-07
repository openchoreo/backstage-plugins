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

  // MUI v4 TextField doesn't link <label> via htmlFor, so getByLabelText
  // fails. Query by the visible label text rendered inside the wrapping
  // FormControl and walk to the input it controls.
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

  it('keeps Create disabled with a valid name + plane but empty Opaque data', async () => {
    const user = userEvent.setup();
    renderDialog({ targetPlanes: planes });
    await user.type(inputForLabel('Secret Name'), 'my-secret');
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('disables Create for Basic Auth when password is empty', async () => {
    const user = userEvent.setup();
    renderDialog({ targetPlanes: planes });
    await user.type(inputForLabel('Secret Name'), 'basic');
    await user.click(screen.getByRole('radio', { name: /Basic Auth/i }));
    // Username alone is not enough — password is required.
    await user.type(inputForLabel('Username'), 'alice');
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('enables Create for Basic Auth once a password is provided', async () => {
    const user = userEvent.setup();
    renderDialog({ targetPlanes: planes });
    await user.type(inputForLabel('Secret Name'), 'basic');
    await user.click(screen.getByRole('radio', { name: /Basic Auth/i }));
    await user.type(inputForLabel('Password / Token'), 'hunter2');
    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled();
  });

  it('disables Create for Docker Config when JSON is invalid', async () => {
    const user = userEvent.setup();
    renderDialog({ targetPlanes: planes });
    await user.type(inputForLabel('Secret Name'), 'docker');
    await user.click(screen.getByRole('radio', { name: /Docker Config/i }));
    await user.type(inputForLabel('.dockerconfigjson'), 'not-json-{{');
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('disables Create for TLS until both crt and key are provided', async () => {
    const user = userEvent.setup();
    renderDialog({ targetPlanes: planes });
    await user.type(inputForLabel('Secret Name'), 'tls-secret');
    await user.click(screen.getByRole('radio', { name: /^TLS/i }));
    await user.type(inputForLabel('tls.crt'), 'crt-pem');
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
    await user.type(inputForLabel('tls.key'), 'key-pem');
    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled();
  });
});
