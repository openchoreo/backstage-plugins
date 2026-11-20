import { fireEvent, render, screen } from '@testing-library/react';
import { ClearOverridesDialog } from './ClearOverridesDialog';

describe('ClearOverridesDialog', () => {
  it('lists what is cleared and clears only on confirm', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    render(
      <ClearOverridesDialog
        open
        envLabel="Staging"
        configFields={2}
        trafficBackends={1}
        clearing={false}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    expect(
      screen.getByText('Endpoint type overrides (2 fields)'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Traffic overrides (1 backend)'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Clear' }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('leaves out what the environment does not override', () => {
    render(
      <ClearOverridesDialog
        open
        envLabel="Staging"
        configFields={0}
        trafficBackends={3}
        clearing={false}
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );
    expect(screen.queryByText(/Endpoint type overrides/)).toBeNull();
    expect(
      screen.getByText('Traffic overrides (3 backends)'),
    ).toBeInTheDocument();
  });
});
