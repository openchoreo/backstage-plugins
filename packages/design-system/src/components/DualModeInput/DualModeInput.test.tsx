import { render, screen, fireEvent } from '@testing-library/react';
import { DualModeInput } from './DualModeInput';

describe('DualModeInput', () => {
  const plainContent = <div>Plain input field</div>;
  const secretContent = <div>Secret reference field</div>;

  it('renders plainContent when mode is plain', () => {
    render(
      <DualModeInput
        mode="plain"
        onModeChange={jest.fn()}
        plainContent={plainContent}
        secretContent={secretContent}
      />,
    );

    expect(screen.getByText('Plain input field')).toBeInTheDocument();
    expect(
      screen.queryByText('Secret reference field'),
    ).not.toBeInTheDocument();
  });

  it('renders secretContent when mode is secret', () => {
    render(
      <DualModeInput
        mode="secret"
        onModeChange={jest.fn()}
        plainContent={plainContent}
        secretContent={secretContent}
      />,
    );

    expect(screen.getByText('Secret reference field')).toBeInTheDocument();
    expect(screen.queryByText('Plain input field')).not.toBeInTheDocument();
  });

  it('calls onModeChange with opposite mode when toggle is clicked', () => {
    const onModeChange = jest.fn();
    render(
      <DualModeInput
        mode="plain"
        onModeChange={onModeChange}
        plainContent={plainContent}
        secretContent={secretContent}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Switch to secret reference' }),
    );
    expect(onModeChange).toHaveBeenCalledWith('secret');
  });

  it('calls onModeChange with "plain" when toggling from secret mode', () => {
    const onModeChange = jest.fn();
    render(
      <DualModeInput
        mode="secret"
        onModeChange={onModeChange}
        plainContent={plainContent}
        secretContent={secretContent}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Switch to plain value' }),
    );
    expect(onModeChange).toHaveBeenCalledWith('plain');
  });

  it('prevents toggle when disabled', () => {
    const onModeChange = jest.fn();
    render(
      <DualModeInput
        mode="plain"
        onModeChange={onModeChange}
        plainContent={plainContent}
        secretContent={secretContent}
        disabled
      />,
    );

    const toggleButton = screen.getByRole('button', {
      name: 'Switch to secret reference',
    });
    expect(toggleButton).toBeDisabled();
  });
});
