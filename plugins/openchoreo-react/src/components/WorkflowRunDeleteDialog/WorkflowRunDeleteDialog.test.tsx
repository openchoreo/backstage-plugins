import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkflowRunDeleteDialog } from './WorkflowRunDeleteDialog';

describe('WorkflowRunDeleteDialog', () => {
  const props = {
    open: true,
    runName: 'greeter-build-34',
    deleting: false,
    onCancel: jest.fn(),
    onConfirm: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('identifies the selected run and explains permanent deletion', () => {
    render(
      <WorkflowRunDeleteDialog {...props}>
        <span>Failed</span>
        <span>main</span>
      </WorkflowRunDeleteDialog>,
    );
    const dialog = within(
      screen.getByRole('dialog', { name: 'Delete Workflow Run' }),
    );
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
      /greeter-build-34 and its associated resources/,
    );
    expect(dialog.getByText(/This action cannot be undone/)).toHaveTextContent(
      'greeter-build-34 and its associated resources in the workflow plane will be permanently deleted.',
    );
    expect(dialog.getByText('Failed')).toBeInTheDocument();
    expect(dialog.getByText('main')).toBeInTheDocument();
  });

  it('allows Escape to cancel before deletion starts', async () => {
    render(<WorkflowRunDeleteDialog {...props} />);
    await userEvent.setup().keyboard('{Escape}');
    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('blocks Escape and buttons while deletion is pending', async () => {
    render(<WorkflowRunDeleteDialog {...props} deleting />);
    const user = userEvent.setup();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled();
    expect(props.onCancel).not.toHaveBeenCalled();
    expect(props.onConfirm).not.toHaveBeenCalled();
  });
});
