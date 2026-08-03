import { render, waitFor, screen } from '@testing-library/react';
import { BuildWorkflowPicker } from './BuildWorkflowPickerExtension';
import type { WorkflowSelection } from './BuildWorkflowPickerExtension';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';

// Mock useApi to return mock discovery and fetch APIs
const mockFetch = jest.fn();
jest.mock('@backstage/core-plugin-api', () => ({
  ...jest.requireActual('@backstage/core-plugin-api'),
  useApi: (ref: any) => {
    if (ref.id === 'core.discovery') {
      return {
        getBaseUrl: jest.fn().mockResolvedValue('http://test/api'),
      };
    }
    if (ref.id === 'core.fetch') {
      return { fetch: mockFetch };
    }
    return {};
  },
}));

describe('BuildWorkflowPickerExtension', () => {
  beforeEach(() => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('cluster-workflows')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                items: [{ metadata: { name: 'dockerfile-builder' }, spec: {} }],
              },
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [{ metadata: { name: 'nodejs-build' }, spec: {} }],
          }),
      });
    });
  });

  it('renders the workflow picker field with label', async () => {
    const props = {
      onChange: jest.fn(),
      rawErrors: [],
      required: false,
      formData: undefined as WorkflowSelection | undefined,
      idSchema: { $id: 'workflow_name' },
      uiSchema: {
        'ui:options': {
          namespaceName: 'test-ns',
          allowedWorkflows: [
            { kind: 'Workflow', name: 'nodejs-build' },
            { kind: 'ClusterWorkflow', name: 'dockerfile-builder' },
          ],
        },
      },
      schema: { type: 'string' },
      formContext: {
        formData: {
          project_namespace: { namespace_name: 'test-ns' },
        },
      },
    } as unknown as FieldExtensionComponentProps<WorkflowSelection, {}>;

    render(<BuildWorkflowPicker {...props} />);

    // Component renders with the label (MUI renders label in multiple places)
    expect(screen.getAllByText('Build Workflow').length).toBeGreaterThan(0);

    // After fetch, the select should have options (rendered as hidden MUI MenuItems)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
  });
});
