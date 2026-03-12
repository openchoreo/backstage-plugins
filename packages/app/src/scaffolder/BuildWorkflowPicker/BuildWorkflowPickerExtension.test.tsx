import { render } from '@testing-library/react';
import { BuildWorkflowPicker } from './BuildWorkflowPickerExtension';
import type { WorkflowSelection } from './BuildWorkflowPickerExtension';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';

describe('BuildWorkflowPickerExtension', () => {
  const renderWithProps = (schemaEnum: string[]) => {
    const props = {
      onChange: jest.fn(),
      rawErrors: [],
      required: false,
      formData: undefined as WorkflowSelection | undefined,
      idSchema: { $id: 'workflow_name' },
      uiSchema: {},
      schema: {
        type: 'string',
        enum: schemaEnum,
      },
      formContext: { formData: {} },
    } as unknown as FieldExtensionComponentProps<WorkflowSelection, {}>;

    return render(<BuildWorkflowPicker {...props} />);
  };

  it('renders human-friendly labels for ClusterWorkflow-prefixed enum values', () => {
    const { getByText } = renderWithProps([
      'nodejs-build',
      'ClusterWorkflow:dockerfile-builder',
    ]);

    // Plain workflow name should render as-is
    expect(getByText('nodejs-build')).toBeInTheDocument();
    // ClusterWorkflow entry should strip the prefix in the label
    expect(getByText('dockerfile-builder')).toBeInTheDocument();
  });
});
