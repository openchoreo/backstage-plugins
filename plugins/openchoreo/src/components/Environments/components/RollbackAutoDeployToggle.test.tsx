import { render, screen } from '@testing-library/react';
import { RollbackAutoDeployToggle } from './RollbackAutoDeployToggle';

jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => ({
    entity: {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: { name: 'api', namespace: 'default' },
    },
  }),
}));

jest.mock('../hooks/useAutoDeployUpdate', () => ({
  useAutoDeployUpdate: () => ({
    updateAutoDeploy: jest.fn(),
    isUpdating: false,
  }),
}));

const refetchAutoDeploy = jest.fn();
let autoDeploy = false;

jest.mock('../EnvironmentsContext', () => ({
  useEnvironmentsContext: () => ({
    autoDeploy,
    autoDeployLoading: false,
    setAutoDeployOptimistic: jest.fn(),
    refetchAutoDeploy,
  }),
}));

describe('RollbackAutoDeployToggle', () => {
  beforeEach(() => {
    refetchAutoDeploy.mockClear();
    autoDeploy = false;
  });

  it('reads the auto deploy setting again when it appears', () => {
    render(<RollbackAutoDeployToggle onChanged={jest.fn()} />);
    expect(refetchAutoDeploy).toHaveBeenCalledTimes(1);
  });

  it('does not read it again on re-render', () => {
    const { rerender } = render(
      <RollbackAutoDeployToggle onChanged={jest.fn()} />,
    );
    rerender(<RollbackAutoDeployToggle onChanged={jest.fn()} />);
    expect(refetchAutoDeploy).toHaveBeenCalledTimes(1);
  });

  it('shows the setting it is given', () => {
    autoDeploy = true;
    render(<RollbackAutoDeployToggle onChanged={jest.fn()} />);
    expect(screen.getByRole('checkbox', { name: 'Auto Deploy' })).toBeChecked();
  });
});
