import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateSecretDialog, WorkflowPlaneOption } from './CreateSecretDialog';

// ---- Helpers ----

const planes: WorkflowPlaneOption[] = [
  { name: 'default-plane', kind: 'WorkflowPlane' },
  { name: 'shared-plane', kind: 'ClusterWorkflowPlane' },
];

function renderDialog(
  overrides: Partial<React.ComponentProps<typeof CreateSecretDialog>> = {},
) {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    onSubmit: jest.fn().mockResolvedValue(undefined),
    namespaceName: 'test-ns',
    existingSecretNames: [] as string[],
    workflowPlanes: planes,
    workflowPlanesLoading: false,
  };

  return {
    ...render(<CreateSecretDialog {...defaultProps} {...overrides} />),
    props: { ...defaultProps, ...overrides },
  };
}

// ---- Tests ----

describe('CreateSecretDialog', () => {
  it('renders dialog title and namespace info when open', () => {
    renderDialog();

    expect(screen.getByText('Create Git Secret')).toBeInTheDocument();
    expect(screen.getByText('test-ns')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    renderDialog({ open: false });

    expect(screen.queryByText('Create Git Secret')).not.toBeInTheDocument();
  });

  it('defaults to Basic Authentication type', () => {
    renderDialog();

    const basicRadio = screen.getByLabelText('Basic Authentication');
    expect(basicRadio).toBeChecked();
  });

  it('shows basic auth fields by default', () => {
    renderDialog();

    expect(
      screen.getByText('Username for git authentication.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Your git provider password or access token/),
    ).toBeInTheDocument();
  });

  it('switches to SSH auth fields when SSH radio is selected', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByLabelText('SSH Authentication'));

    expect(
      screen.getByText('SSH key identifier for git authentication.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Drag and drop file with your private SSH key/),
    ).toBeInTheDocument();
  });

  it('disables Create button when secret name is empty', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('disables Create button when basic auth token is empty', async () => {
    const user = userEvent.setup();
    renderDialog();

    // Type a secret name but leave token empty
    const inputs = screen.getAllByRole('textbox');
    // First textbox is Secret Name
    await user.type(inputs[0], 'my-secret');

    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('enables Create button when name and token are filled', async () => {
    const user = userEvent.setup();
    renderDialog();

    const inputs = screen.getAllByRole('textbox');
    // Secret Name
    await user.type(inputs[0], 'my-secret');
    // Username (optional)
    // Password or Token - it's a password field, not a textbox
    // Need to find the password input differently
    const passwordInput = document.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    await user.type(passwordInput, 'my-token');

    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled();
  });

  it('shows error for duplicate secret name on submit', async () => {
    const user = userEvent.setup();
    renderDialog({ existingSecretNames: ['existing-secret'] });

    const inputs = screen.getAllByRole('textbox');
    await user.type(inputs[0], 'existing-secret');

    const passwordInput = document.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    await user.type(passwordInput, 'token');

    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(
      screen.getByText(/A secret with this name already exists/),
    ).toBeInTheDocument();
  });

  it('shows error for invalid secret name format', async () => {
    const user = userEvent.setup();
    renderDialog();

    const inputs = screen.getAllByRole('textbox');
    await user.type(inputs[0], 'invalid_name!');

    const passwordInput = document.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    await user.type(passwordInput, 'token');

    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(
      screen.getByText(/must consist of lowercase alphanumeric characters/),
    ).toBeInTheDocument();
  });

  it('keeps Create button disabled when name is filled but token is empty', async () => {
    const user = userEvent.setup();
    renderDialog();

    const inputs = screen.getAllByRole('textbox');
    await user.type(inputs[0], 'my-secret');

    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('calls onSubmit with correct args and closes on success', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();

    renderDialog({ onSubmit, onClose });

    const inputs = screen.getAllByRole('textbox');
    await user.type(inputs[0], 'my-secret');

    // Type username
    await user.type(inputs[1], 'myuser');

    const passwordInput = document.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    await user.type(passwordInput, 'my-token');

    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        'my-secret',
        'basic-auth',
        'my-token',
        'myuser',
        undefined,
        'WorkflowPlane',
        'default-plane',
      );
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows error when onSubmit rejects', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockRejectedValue(new Error('Create failed'));

    renderDialog({ onSubmit });

    const inputs = screen.getAllByRole('textbox');
    await user.type(inputs[0], 'my-secret');

    const passwordInput = document.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    await user.type(passwordInput, 'token');

    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(screen.getByText('Create failed')).toBeInTheDocument();
    });
  });

  it('shows "Creating..." and disables buttons when loading', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockReturnValue(new Promise(() => {})); // never resolves

    renderDialog({ onSubmit });

    const inputs = screen.getAllByRole('textbox');
    await user.type(inputs[0], 'my-secret');

    const passwordInput = document.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    await user.type(passwordInput, 'token');

    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();

    renderDialog({ onClose });

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onClose).toHaveBeenCalled();
  });

  it('shows SSH key validation error for invalid key format', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByLabelText('SSH Authentication'));

    const inputs = screen.getAllByRole('textbox');
    // Secret Name
    await user.type(inputs[0], 'ssh-secret');
    // SSH Private Key textarea
    const sshKeyTextarea = inputs[inputs.length - 1];
    await user.type(sshKeyTextarea, 'not-a-valid-key');

    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(screen.getByText(/Invalid SSH key format/)).toBeInTheDocument();
  });

  it('keeps Create button disabled when SSH auth selected but key is empty', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByLabelText('SSH Authentication'));

    const inputs = screen.getAllByRole('textbox');
    await user.type(inputs[0], 'ssh-secret');

    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });
});
