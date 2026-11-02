import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { check } from '../../__testUtils__/testApis';
import { DeleteCheckDialog } from './DeleteCheckDialog';

describe('DeleteCheckDialog', () => {
  it('confirms deleting the check', async () => {
    const onConfirm = jest.fn(async () => {});
    render(
      <DeleteCheckDialog
        check={check({ status: 'published' })}
        onCancel={jest.fn()}
        onConfirm={onConfirm}
      />,
    );
    expect(
      screen.getByText(/The check is published, so scores will no longer/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'readme' }),
    );
  });

  it("drops a failed delete's error when it shows another check", async () => {
    const onConfirm = jest.fn(async () => {
      throw new Error('Delete failed.');
    });
    const { rerender } = render(
      <DeleteCheckDialog
        check={check()}
        onCancel={jest.fn()}
        onConfirm={onConfirm}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Delete failed.')).toBeInTheDocument();

    rerender(
      <DeleteCheckDialog
        check={check({ id: 'owner', name: 'Has an owner' })}
        onCancel={jest.fn()}
        onConfirm={onConfirm}
      />,
    );
    await waitFor(() =>
      expect(screen.queryByText('Delete failed.')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Has an owner')).toBeInTheDocument();
  });

  it('cancels', async () => {
    const onCancel = jest.fn();
    render(
      <DeleteCheckDialog
        check={check()}
        onCancel={onCancel}
        onConfirm={jest.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
