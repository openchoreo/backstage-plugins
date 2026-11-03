import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { WorkflowRunsContent } from './WorkflowRunsContent';
import { TestApiProvider } from '@backstage/test-utils';
import { alertApiRef } from '@backstage/core-plugin-api';
import { genericWorkflowsClientApiRef } from '../../api';

// Mocks
jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => ({
    entity: {
      metadata: { name: 'test-workflow' },
      kind: 'Workflow',
    },
  }),
}));

const mockSearchParams = new URLSearchParams();
const setSearchParams = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useSearchParams: () => [mockSearchParams, setSearchParams],
}));

const mockRefetch = jest.fn();
const defaultRuns = [
  { name: 'run-1', phase: 'Succeeded', namespaceName: 'default' },
  { name: 'run-2', phase: 'Failed', namespaceName: 'default' },
];
let mockRuns = defaultRuns.map(run => ({ ...run }));
jest.mock('../../hooks/useWorkflowRuns', () => ({
  useWorkflowRuns: () => ({
    runs: mockRuns,
    loading: false,
    error: null,
    refetch: mockRefetch,
  }),
}));

jest.mock('../../hooks/useWorkflowRunDetails', () => ({
  useWorkflowRunDetails: () => ({ run: null, loading: false }),
}));

jest.mock('../../hooks/useWorkflowSchema', () => ({
  useWorkflowSchema: () => ({ schema: null, loading: false }),
}));

jest.mock('../../context', () => ({
  useSelectedNamespace: () => 'default',
}));

jest.mock('../../hooks/useNamespaces', () => ({
  useNamespaces: () => ({ namespaces: ['default'], loading: false }),
}));

jest.mock('../WorkflowRunStatusChip', () => ({
  WorkflowRunStatusChip: ({ status }: any) => <span>Status: {status}</span>,
}));

jest.mock('@backstage/core-components', () => ({
  Table: ({ data, actions }: any) => (
    <div data-testid="table">
      {data.map((row: any, i: number) => (
        <div key={i} data-testid={`row-${row.name}`}>
          {row.name}
          {actions?.map((action: any, k: number) => (
            <button
              key={`action-${k}`}
              data-testid={`action-${action.tooltip}-${i}`}
              disabled={action.disabled}
              onClick={e => action.onClick(e, row)}
            >
              {action.tooltip}
            </button>
          ))}
        </div>
      ))}
    </div>
  ),
  Progress: () => <div>Progress</div>,
  Content: ({ children }: any) => <div>{children}</div>,
  InfoCard: ({ children }: any) => <div>{children}</div>,
  StructuredMetadataTable: () => <div>StructuredMetadataTable</div>,
}));

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  WorkflowRunDeleteDialog: jest.requireActual(
    '../../../../openchoreo-react/src/components/WorkflowRunDeleteDialog',
  ).WorkflowRunDeleteDialog,
  formatRelativeTime: (time: string) => time,
  formatDate: (time: string) => time,
  DetailPageLayout: ({ children }: any) => <div>{children}</div>,
  YamlEditor: () => <div>YamlEditor</div>,
  useYamlEditor: () => ({}),
}));

jest.mock('../WorkflowRunStepLogs', () => ({
  WorkflowRunStepLogs: () => <div>WorkflowRunStepLogs</div>,
}));

const mockWorkflowsClient = {
  deleteWorkflowRun: jest.fn(),
};

const mockAlertApi = {
  post: jest.fn(),
};

function renderComponent() {
  return render(
    <TestApiProvider
      apis={[
        [genericWorkflowsClientApiRef, mockWorkflowsClient],
        [alertApiRef, mockAlertApi],
      ]}
    >
      <WorkflowRunsContent />
    </TestApiProvider>,
  );
}

describe('WorkflowRunsContent', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockRuns = defaultRuns.map(run => ({ ...run }));
  });

  it('renders a list of workflow runs', () => {
    renderComponent();
    expect(screen.getByTestId('row-run-1')).toBeInTheDocument();
    expect(screen.getByTestId('row-run-2')).toBeInTheDocument();
  });

  it('shows delete dialog and calls deleteWorkflowRun on confirm', async () => {
    const user = userEvent.setup();
    mockWorkflowsClient.deleteWorkflowRun.mockResolvedValue(undefined);

    renderComponent();

    // Click delete action on run-1
    await user.click(screen.getByTestId('action-Delete Run-0'));

    expect(
      screen.getByRole('dialog', { name: 'Delete Workflow Run' }),
    ).toBeInTheDocument();

    // Confirm deletion
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(mockWorkflowsClient.deleteWorkflowRun).toHaveBeenCalledWith(
      'default',
      'run-1',
    );
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('shows error alert if deletion fails', async () => {
    const user = userEvent.setup();
    mockWorkflowsClient.deleteWorkflowRun.mockRejectedValue(
      new Error('Deletion failed'),
    );

    renderComponent();

    // Click delete action on run-2
    await user.click(screen.getByTestId('action-Delete Run-1'));

    expect(
      screen.getByRole('dialog', { name: 'Delete Workflow Run' }),
    ).toBeInTheDocument();

    // Confirm deletion
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(mockWorkflowsClient.deleteWorkflowRun).toHaveBeenCalledWith(
      'default',
      'run-2',
    );
    expect(mockAlertApi.post).toHaveBeenCalledWith({
      message: 'Failed to delete run: Error: Deletion failed',
      severity: 'error',
    });
    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it('cancels without deleting or refreshing', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByTestId('action-Delete Run-0'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(mockWorkflowsClient.deleteWorkflowRun).not.toHaveBeenCalled();
    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it('deletes from the selected row namespace', async () => {
    const user = userEvent.setup();
    mockRuns[0].namespaceName = 'other-namespace';
    renderComponent();
    await user.click(screen.getByTestId('action-Delete Run-0'));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(mockWorkflowsClient.deleteWorkflowRun).toHaveBeenCalledWith(
      'other-namespace',
      'run-1',
    );
  });

  it('captures the list namespace when run metadata omits it', async () => {
    const user = userEvent.setup();
    mockRuns[0].namespaceName = '';
    renderComponent();
    await user.click(screen.getByTestId('action-Delete Run-0'));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(mockWorkflowsClient.deleteWorkflowRun).toHaveBeenCalledWith(
      'default',
      'run-1',
    );
  });
});
