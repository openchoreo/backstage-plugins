import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateCheckButton } from './CreateCheckButton';

const button = () => screen.getByRole('button', { name: 'Create check' });

describe('CreateCheckButton', () => {
  it('goes straight to the form when there is no assistant', async () => {
    const onCreateManually = jest.fn();
    render(
      <CreateCheckButton
        disabled={false}
        onCreateManually={onCreateManually}
      />,
    );

    await userEvent.click(button());

    expect(onCreateManually).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('offers both options when there is an assistant', async () => {
    const onCreateManually = jest.fn();
    const onGenerateWithAi = jest.fn();
    render(
      <CreateCheckButton
        disabled={false}
        onCreateManually={onCreateManually}
        onGenerateWithAi={onGenerateWithAi}
      />,
    );

    await userEvent.click(button());

    expect(onCreateManually).not.toHaveBeenCalled();
    expect(onGenerateWithAi).not.toHaveBeenCalled();
    expect(
      screen.getByRole('menuitem', { name: 'Create manually' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'Generate with AI' }),
    ).toBeInTheDocument();
  });

  it('runs the chosen option once', async () => {
    const onCreateManually = jest.fn();
    const onGenerateWithAi = jest.fn();
    render(
      <CreateCheckButton
        disabled={false}
        onCreateManually={onCreateManually}
        onGenerateWithAi={onGenerateWithAi}
      />,
    );

    await userEvent.click(button());
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Generate with AI' }),
    );

    expect(onGenerateWithAi).toHaveBeenCalledTimes(1);
    expect(onCreateManually).not.toHaveBeenCalled();
  });

  it.each([
    ['without an assistant', undefined],
    ['with an assistant', jest.fn()],
  ])('is disabled %s when not allowed', (_label, onGenerateWithAi) => {
    render(
      <CreateCheckButton
        disabled
        onCreateManually={jest.fn()}
        onGenerateWithAi={onGenerateWithAi}
      />,
    );

    expect(button()).toBeDisabled();
  });
});
