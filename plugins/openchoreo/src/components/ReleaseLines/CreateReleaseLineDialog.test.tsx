import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CreateReleaseLineDialog } from './CreateReleaseLineDialog';

function renderDialog(onCreate = jest.fn().mockResolvedValue(undefined)) {
  const onClose = jest.fn();
  render(
    <CreateReleaseLineDialog
      open
      componentName="hello"
      creating={false}
      onClose={onClose}
      onCreate={onCreate}
    />,
  );
  return { onCreate, onClose };
}

describe('CreateReleaseLineDialog', () => {
  it('asks for a name and a description, and explains where overrides are made', () => {
    renderDialog();

    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    expect(
      screen.getByRole('textbox', { name: /description/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument();
    expect(
      screen.getByText(/once the release line is created/),
    ).toBeInTheDocument();
  });

  it('creates the line with the entered name', async () => {
    const { onCreate, onClose } = renderDialog();

    fireEvent.change(screen.getByRole('textbox', { name: /name/i }), {
      target: { value: 'next' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onCreate).toHaveBeenCalledWith('next', undefined);
  });

  it('passes the description when one is given', async () => {
    const { onCreate, onClose } = renderDialog();

    fireEvent.change(screen.getByRole('textbox', { name: /name/i }), {
      target: { value: 'next' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /description/i }), {
      target: { value: ' Builds the next branch ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onCreate).toHaveBeenCalledWith('next', 'Builds the next branch');
  });

  it('rejects an invalid name', () => {
    const { onCreate } = renderDialog();

    fireEvent.change(screen.getByRole('textbox', { name: /name/i }), {
      target: { value: 'Next/1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByText(/lowercase letters/)).toBeInTheDocument();
  });
});
