import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectSetupDetailPane } from './ProjectSetupDetailPane';

const mockUpdatePerm = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useProjectUpdatePermission: () => mockUpdatePerm(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdatePerm.mockReturnValue({
    canUpdate: true,
    loading: false,
    updateDeniedTooltip: '',
  });
});

describe('ProjectSetupDetailPane', () => {
  it('invokes Configure & Deploy and Close', () => {
    const onConfigureDeploy = jest.fn();
    const onClose = jest.fn();
    render(
      <ProjectSetupDetailPane
        onConfigureDeploy={onConfigureDeploy}
        onClose={onClose}
      />,
    );

    expect(
      screen.getByText(
        /manage project configuration and deploy a new version/i,
      ),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /configure & deploy/i }),
    );
    expect(onConfigureDeploy).toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole('button', { name: /close detail panel/i }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('disables Configure & Deploy without project-update permission', () => {
    mockUpdatePerm.mockReturnValue({
      canUpdate: false,
      loading: false,
      updateDeniedTooltip: 'nope',
    });
    render(
      <ProjectSetupDetailPane
        onConfigureDeploy={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: /configure & deploy/i }),
    ).toBeDisabled();
  });
});
