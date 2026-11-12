import { fireEvent, render, screen } from '@testing-library/react';
import { DeploymentSourcePicker } from './DeploymentSourcePicker';
import type { WorkflowPlaneAvailability } from '../../hooks/useWorkflowPlaneAvailability';

let mockAvailability: WorkflowPlaneAvailability = { status: 'idle' };
jest.mock('../../hooks/useWorkflowPlaneAvailability', () => ({
  ...jest.requireActual('../../hooks/useWorkflowPlaneAvailability'),
  useWorkflowPlaneAvailability: () => mockAvailability,
}));

describe('DeploymentSourcePicker', () => {
  const onChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockAvailability = {
      status: 'missing',
      planeKind: 'ClusterWorkflowPlane',
      planeName: 'default',
    };
  });

  function renderPicker(formData = 'build-from-source') {
    const props = {
      onChange,
      formData,
      schema: { title: 'Deployment Source' },
      formContext: {
        formData: {
          buildAndDeploy: {
            workflow_name: { kind: 'Workflow', name: 'build' },
          },
          project_namespace: { namespace_name: 'team-a' },
        },
      },
    } as unknown as React.ComponentProps<typeof DeploymentSourcePicker>;

    return render(<DeploymentSourcePicker {...props} />);
  }

  it('warns when the selected built-in workflow plane is missing', () => {
    renderPicker();

    expect(
      screen.getByText(/ClusterWorkflowPlane "default" was not found/),
    ).toBeInTheDocument();
    expect(screen.getByText('Build from Source')).toBeInTheDocument();
  });

  it('warns when the selected workflow plane is disconnected', () => {
    mockAvailability = {
      status: 'disconnected',
      planeKind: 'WorkflowPlane',
      planeName: 'default',
    };
    renderPicker();

    expect(
      screen.getByText(/WorkflowPlane "default" is disconnected/),
    ).toBeInTheDocument();
  });

  it('keeps the Build from Source option selectable while a check is loading', () => {
    mockAvailability = { status: 'loading' };
    renderPicker();

    expect(
      screen.getByText('Checking workflow plane availability...'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText('Build from Source'));
    expect(onChange).toHaveBeenCalledWith('build-from-source');
  });

  it('does not describe a forbidden check as a missing installation', () => {
    mockAvailability = { status: 'forbidden' };
    renderPicker();

    expect(screen.getByText(/do not have permission/)).toBeInTheDocument();
    expect(screen.queryByText(/was not found/)).not.toBeInTheDocument();
  });
});
