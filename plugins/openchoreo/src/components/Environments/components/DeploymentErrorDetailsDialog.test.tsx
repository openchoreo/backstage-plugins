import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeploymentErrorDetailsDialog } from './DeploymentErrorDetailsDialog';

describe('DeploymentErrorDetailsDialog', () => {
  it('renders the reason chip and full message when open', () => {
    render(
      <DeploymentErrorDetailsDialog
        open
        onClose={jest.fn()}
        reason="RenderingFailed"
        message={'line one\nline two with detail'}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('RenderingFailed')).toBeInTheDocument();
    expect(screen.getByText(/line two with detail/)).toBeInTheDocument();
  });

  it('renders a Copy action', () => {
    render(
      <DeploymentErrorDetailsDialog
        open
        onClose={jest.fn()}
        reason="RenderingFailed"
        message="boom"
      />,
    );
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(
      <DeploymentErrorDetailsDialog
        open={false}
        onClose={jest.fn()}
        message="hidden"
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('fires onClose from the Close button', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(
      <DeploymentErrorDetailsDialog open onClose={onClose} message="boom" />,
    );
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a generic fallback when no message is provided', () => {
    render(<DeploymentErrorDetailsDialog open onClose={jest.fn()} />);
    expect(
      screen.getByText(/could not roll out this release/i),
    ).toBeInTheDocument();
  });
});
