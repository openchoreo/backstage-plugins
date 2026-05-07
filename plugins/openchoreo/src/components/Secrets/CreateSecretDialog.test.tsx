import { render, screen } from '@testing-library/react';
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
