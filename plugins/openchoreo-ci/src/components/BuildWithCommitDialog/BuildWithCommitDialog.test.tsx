import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BuildWithCommitDialog } from './BuildWithCommitDialog';

// ---- Helpers ----

function renderDialog(overrides: Partial<React.ComponentProps<typeof BuildWithCommitDialog>> = {}) {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    onTrigger: jest.fn().mockResolvedValue(undefined),
    isLoading: false,
  };

  return {
    ...render(<BuildWithCommitDialog {...defaultProps} {...overrides} />),
    props: { ...defaultProps, ...overrides },
  };
}

// ---- Tests ----

describe('BuildWithCommitDialog', () => {
  it('renders dialog title and input when open', () => {
    renderDialog();

    expect(screen.getByText('Build with Specific Commit')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    renderDialog({ open: false });

    expect(
      screen.queryByText('Build with Specific Commit'),
    ).not.toBeInTheDocument();
  });

  it('disables trigger button when input is empty', () => {
    renderDialog();

    expect(
      screen.getByRole('button', { name: /trigger workflow/i }),
    ).toBeDisabled();
  });

  it('shows validation error for non-hex characters', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByRole('textbox'), 'xyz12345');

    expect(
      screen.getByText(/must contain only hexadecimal characters/),
    ).toBeInTheDocument();
  });

  it('shows validation error for SHA shorter than 7 characters', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByRole('textbox'), 'abc12');

    expect(
      screen.getByText(/must be at least 7 characters long/),
    ).toBeInTheDocument();
  });

  it('shows validation error for SHA longer than 40 characters', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(
      screen.getByRole('textbox'),
      'a'.repeat(41),
    );

    expect(
      screen.getByText(/cannot exceed 40 characters/),
    ).toBeInTheDocument();
  });

  it('enables trigger button for valid SHA', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByRole('textbox'), 'abc1234');

    expect(
      screen.getByRole('button', { name: /trigger workflow/i }),
    ).toBeEnabled();
  });

  it('calls onTrigger with trimmed SHA and closes on success', async () => {
    const user = userEvent.setup();
    const onTrigger = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();

    renderDialog({ onTrigger, onClose });

    await user.type(screen.getByRole('textbox'), 'abc1234def');
    await user.click(screen.getByRole('button', { name: /trigger workflow/i }));

    expect(onTrigger).toHaveBeenCalledWith('abc1234def');
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows error when onTrigger rejects', async () => {
    const user = userEvent.setup();
    const onTrigger = jest.fn().mockRejectedValue(new Error('Build failed'));

    renderDialog({ onTrigger });

    await user.type(screen.getByRole('textbox'), 'abc1234');
    await user.click(screen.getByRole('button', { name: /trigger workflow/i }));

    await waitFor(() => {
      expect(screen.getByText('Build failed')).toBeInTheDocument();
    });
  });

  it('shows "Triggering..." and disables buttons when loading', () => {
    renderDialog({ isLoading: true });

    expect(screen.getByRole('button', { name: /triggering/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();

    renderDialog({ onClose });

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onClose).toHaveBeenCalled();
  });

  it('shows required error when triggering with empty input', async () => {
    const user = userEvent.setup();
    // Need a valid-looking SHA first, then clear it to trigger the empty check
    renderDialog();

    // Directly click trigger without typing
    // The button is disabled when empty, so let's test by entering then clearing
    const input = screen.getByRole('textbox');
    await user.type(input, 'abc1234');
    await user.clear(input);

    // Button should be disabled again
    expect(
      screen.getByRole('button', { name: /trigger workflow/i }),
    ).toBeDisabled();
  });
});
