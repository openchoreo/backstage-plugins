import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TestApiProvider } from '@backstage/test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import {
  alertApiRef,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { mockComponentEntity } from '@openchoreo/test-utils';
import { openChoreoCiClientApiRef } from '../../api/OpenChoreoCiClientApi';
import { Workflows } from './Workflows';

// ---- Mocks ----

// Mock styles (no-op)
jest.mock('./styles', () => ({
  useStyles: () => ({
    container: 'container',
    header: 'header',
    headerTitle: 'headerTitle',
    headerActions: 'headerActions',
    notFoundContainer: 'notFoundContainer',
  }),
}));

// Mock useWorkflowData, useWorkflowRouting, useWorkflowRetention
const mockUseWorkflowData = jest.fn();
const mockUseWorkflowRouting = jest.fn();
jest.mock('../../hooks', () => ({
  useWorkflowData: () => mockUseWorkflowData(),
  useWorkflowRouting: () => mockUseWorkflowRouting(),
  useWorkflowRetention: () => undefined,
}));

// Stable mock objects so useApi does not produce new references each call
const mockCiClient = {
  fetchWorkflowSchema: jest.fn().mockResolvedValue({ success: true }),
};
const mockDiscoveryApi = {
  getBaseUrl: jest.fn().mockResolvedValue('http://localhost'),
};
const mockFetchApi = {
  fetch: jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
};

// Mock @backstage/core-components
jest.mock('@backstage/core-components', () => ({
  Progress: () => <div data-testid="progress">Loading...</div>,
  ResponseErrorPanel: (props: any) => (
    <div data-testid="error-panel">{props.error?.message}</div>
  ),
  EmptyState: (props: any) => (
    <div data-testid="empty-state">
      <span>{props.title}</span>
      <span>{props.description}</span>
    </div>
  ),
}));

// Mock @openchoreo/backstage-plugin-react
const mockUseBuildPermission = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useComponentEntityDetails: () => ({
    getEntityDetails: jest.fn().mockResolvedValue({
      componentName: 'test-component',
      projectName: 'test-project',
      namespaceName: 'test-ns',
    }),
  }),
  useBuildPermission: () => mockUseBuildPermission(),
  useOpenChoreoMutation: (fn: any, opts?: any) => ({
    mutate: async (...args: any[]) => {
      try {
        const res = await fn(...args);
        await opts?.onSuccess?.(res, args);
        return res;
      } catch (err: any) {
        await opts?.onError?.(err, args);
        throw err;
      }
    },
    isLoading: false,
    error: null,
    reset: jest.fn(),
  }),
  ForbiddenState: (props: any) => (
    <div data-testid="forbidden-state">{props.message}</div>
  ),
  // Renders nothing, like the real slot with no assistant registered.
  BuildFailureNotifierSlot: () => null,
}));

// Mock @openchoreo/backstage-plugin-common
jest.mock('@openchoreo/backstage-plugin-common', () => ({
  CHOREO_LABELS: {
    WORKFLOW_PROJECT: 'openchoreo.io/project',
    WORKFLOW_COMPONENT: 'openchoreo.io/component',
  },
  CHOREO_ANNOTATIONS: {
    NAMESPACE: 'openchoreo.io/namespace',
  },
  filterEmptyObjectProperties: (obj: any) => obj,
}));

// Mock schemaExtensions utils
jest.mock('../../utils/schemaExtensions', () => ({
  walkSchemaForGitFields: () => ({}),
}));

// Mock @openchoreo/backstage-design-system
jest.mock('@openchoreo/backstage-design-system', () => ({
  VerticalTabNav: ({ children, tabs }: any) => (
    <div data-testid="vertical-tab-nav">
      {tabs?.map((t: any) => (
        <span key={t.id} data-testid={`tab-${t.id}`}>
          {t.label}
          {t.count !== undefined && ` (${t.count})`}
        </span>
      ))}
      {children}
    </div>
  ),
  SplitButton: (props: any) => (
    <div data-testid="split-button-group">
      <button
        data-testid="split-button"
        disabled={props.disabled}
        onClick={() => props.onClick?.('build-latest')}
      >
        Build
      </button>
      <button
        data-testid="split-button-custom"
        disabled={props.disabled}
        onClick={() => props.onClick?.('build-custom')}
      >
        Custom
      </button>
    </div>
  ),
  PageLoader: () => <div data-testid="progress" />,
}));

// Mock child components
jest.mock('../WorkflowConfigPage', () => ({
  WorkflowConfigPage: () => <div data-testid="config-page">Config</div>,
}));
jest.mock('../WorkflowRunDetailsPage', () => ({
  WorkflowRunDetailsPage: () => (
    <div data-testid="run-details-page">Run Details</div>
  ),
}));
jest.mock('../RunsTab', () => ({
  RunsTab: (props: any) => (
    <div data-testid="runs-tab">
      {props.builds?.length ? `${props.builds.length} build(s)` : 'No builds'}
    </div>
  ),
}));
jest.mock('../OverviewTab', () => ({
  OverviewTab: () => <div data-testid="overview-tab">Overview</div>,
}));
jest.mock('../BuildWithParamsDialog', () => ({
  // Mimics the real dialog's handleTrigger → catch → setError flow so we can
  // verify that triggerWithParamsOp throws a friendly message.
  BuildWithParamsDialog: (props: any) => {
    const [err, setErr] = require('react').useState('');
    if (!props.open) return null;
    return (
      <div data-testid="params-dialog">
        <button
          data-testid="params-trigger"
          onClick={async () => {
            try {
              await props.onTrigger({});
            } catch (e: any) {
              setErr(e.message);
            }
          }}
        >
          Trigger
        </button>
        {err && (
          <span data-testid="params-dialog-error">{err}</span>
        )}
      </div>
    );
  },
}));

// ---- Helpers ----

// Stable entity reference so the useEffect dependency on `entity` does not
// trigger infinite re-renders.
const testEntity = mockComponentEntity();

const mockAlertApi = {
  post: jest.fn(),
  alert$: jest.fn(),
};

function renderWithRouter(
  ui: React.ReactElement,
  options?: { alertApi?: typeof mockAlertApi },
) {
  const alertApi = options?.alertApi ?? mockAlertApi;
  return render(
    <MemoryRouter>
      <TestApiProvider
        apis={[
          [openChoreoCiClientApiRef, mockCiClient],
          [discoveryApiRef, mockDiscoveryApi],
          [fetchApiRef, mockFetchApi],
          [alertApiRef, alertApi],
        ]}
      >
        <EntityProvider entity={testEntity}>{ui}</EntityProvider>
      </TestApiProvider>
    </MemoryRouter>,
  );
}

const defaultRoutingState = {
  state: {
    view: 'list' as const,
    tab: 'runs' as const,
    runDetailsTab: 'logs' as const,
  },
  setTab: jest.fn(),
  setRunDetailsTab: jest.fn(),
  navigateToList: jest.fn(),
  navigateToConfig: jest.fn(),
  navigateToRunDetails: jest.fn(),
  goBack: jest.fn(),
};

const defaultBuildPermission = {
  canBuild: true,
  canView: true,
  triggerLoading: false,
  viewLoading: false,
  triggerBuildDeniedTooltip: '',
  viewPermissionName: 'openchoreo.build.view',
};

// ---- Tests ----

describe('Workflows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAlertApi.post.mockClear();
    mockUseWorkflowRouting.mockReturnValue(defaultRoutingState);
    mockUseBuildPermission.mockReturnValue(defaultBuildPermission);
  });

  it('shows loading state when workflow data is loading', () => {
    mockUseWorkflowData.mockReturnValue({
      builds: [],
      componentDetails: null,
      loading: true,
      error: null,
      fetchBuilds: jest.fn(),
      fetchComponentDetails: jest.fn(),
    });

    renderWithRouter(<Workflows />);

    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('renders workflow information with builds when loaded', () => {
    mockUseWorkflowData.mockReturnValue({
      builds: [
        {
          name: 'build-1',
          uuid: 'uuid-1',
          componentName: 'test-component',
          projectName: 'test-project',
          namespaceName: 'test-ns',
          status: 'Succeeded',
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          name: 'build-2',
          uuid: 'uuid-2',
          componentName: 'test-component',
          projectName: 'test-project',
          namespaceName: 'test-ns',
          status: 'Running',
          createdAt: '2024-01-02T00:00:00Z',
        },
      ],
      componentDetails: {
        componentWorkflow: {
          name: 'my-workflow',
          kind: 'Workflow',
          parameters: {},
        },
      },
      loading: false,
      error: null,
      fetchBuilds: jest.fn(),
      fetchComponentDetails: jest.fn(),
    });

    renderWithRouter(<Workflows />);

    // Main header should render
    expect(screen.getByText('Workflows')).toBeInTheDocument();
    // Tab nav with tabs rendered
    expect(screen.getByTestId('vertical-tab-nav')).toBeInTheDocument();
    expect(screen.getByTestId('tab-runs')).toBeInTheDocument();
    expect(screen.getByText(/Runs/)).toBeInTheDocument();
    // RunsTab receives the builds
    expect(screen.getByTestId('runs-tab')).toBeInTheDocument();
    expect(screen.getByText('2 build(s)')).toBeInTheDocument();
    // Build button should be present
    expect(screen.getByTestId('split-button')).toBeInTheDocument();
  });

  it('shows empty state when component has no workflow configured', () => {
    mockUseWorkflowData.mockReturnValue({
      builds: [],
      componentDetails: {
        componentWorkflow: null,
      },
      loading: false,
      error: null,
      fetchBuilds: jest.fn(),
      fetchComponentDetails: jest.fn(),
    });

    renderWithRouter(<Workflows />);

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('Workflows Not Available')).toBeInTheDocument();
  });

  it('shows error panel when workflow data has an error', () => {
    mockUseWorkflowData.mockReturnValue({
      builds: [],
      componentDetails: null,
      loading: false,
      error: new Error('Failed to fetch workflow data'),
      fetchBuilds: jest.fn(),
      fetchComponentDetails: jest.fn(),
    });

    renderWithRouter(<Workflows />);

    expect(screen.getByTestId('error-panel')).toBeInTheDocument();
    expect(
      screen.getByText('Failed to fetch workflow data'),
    ).toBeInTheDocument();
  });

  describe('Build Latest error handling', () => {
    let unhandledRejections: any[] = [];
    const rejectionHandler = (reason: any) => {
      unhandledRejections.push(reason);
    };

    beforeEach(() => {
      unhandledRejections = [];
      process.on('unhandledRejection', rejectionHandler);

      mockUseWorkflowData.mockReturnValue({
        builds: [],
        componentDetails: {
          componentWorkflow: {
            name: 'my-workflow',
            kind: 'Workflow',
            parameters: {},
          },
        },
        loading: false,
        error: null,
        fetchBuilds: jest.fn(),
        fetchComponentDetails: jest.fn(),
      });
    });

    afterEach(() => {
      process.removeListener('unhandledRejection', rejectionHandler);
    });

    // Go API direct shape: { code: "NOT_FOUND", error: "Workflow not found" }
    it('404 with Go API string-error shape ({error: string}) posts alert', async () => {
      mockFetchApi.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ code: 'NOT_FOUND', error: 'Workflow not found' }),
        text: async () =>
          JSON.stringify({ code: 'NOT_FOUND', error: 'Workflow not found' }),
      });

      renderWithRouter(<Workflows />);

      const buildButton = screen.getByTestId('split-button');
      fireEvent.click(buildButton);

      await waitFor(() => {
        expect(mockAlertApi.post).toHaveBeenCalledTimes(1);
      });
      expect(mockAlertApi.post).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining(
            'The referenced workflow "my-workflow" no longer exists. Please select or configure a new build workflow.',
          ),
          severity: 'error',
        }),
      );
      expect(unhandledRejections).toHaveLength(0);
    });

    // BFF shape (what the browser actually hits):
    // { error: { name: "NotFoundError", message: "Workflow not found" } }
    it('404 with BFF nested-object shape ({error: {message}}) posts alert', async () => {
      mockFetchApi.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({
          error: { name: 'NotFoundError', message: 'Workflow not found' },
        }),
        text: async () =>
          JSON.stringify({
            error: { name: 'NotFoundError', message: 'Workflow not found' },
          }),
      });

      renderWithRouter(<Workflows />);

      const buildButton = screen.getByTestId('split-button');
      fireEvent.click(buildButton);

      await waitFor(() => {
        expect(mockAlertApi.post).toHaveBeenCalledTimes(1);
      });
      expect(mockAlertApi.post).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining(
            'The referenced workflow "my-workflow" no longer exists. Please select or configure a new build workflow.',
          ),
          severity: 'error',
        }),
      );
      expect(unhandledRejections).toHaveLength(0);
    });

    // Message-field shape: { message: "Workflow not found" }
    it('404 with message-field shape ({message}) posts alert', async () => {
      mockFetchApi.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Workflow not found' }),
        text: async () => JSON.stringify({ message: 'Workflow not found' }),
      });

      renderWithRouter(<Workflows />);

      const buildButton = screen.getByTestId('split-button');
      fireEvent.click(buildButton);

      await waitFor(() => {
        expect(mockAlertApi.post).toHaveBeenCalledTimes(1);
      });
      expect(mockAlertApi.post).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining(
            'The referenced workflow "my-workflow" no longer exists. Please select or configure a new build workflow.',
          ),
          severity: 'error',
        }),
      );
      expect(unhandledRejections).toHaveLength(0);
    });

    // Non-JSON body (e.g. HTML 404 page from a proxy)
    it('404 with non-JSON body posts alert with fallback message', async () => {
      mockFetchApi.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => {
          throw new Error('Unexpected token < in JSON');
        },
        text: async () => '<html><body>404 Not Found</body></html>',
      });

      renderWithRouter(<Workflows />);

      const buildButton = screen.getByTestId('split-button');
      fireEvent.click(buildButton);

      await waitFor(() => {
        expect(mockAlertApi.post).toHaveBeenCalledTimes(1);
      });
      expect(mockAlertApi.post).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining(
            'The referenced workflow "my-workflow" no longer exists. Please select or configure a new build workflow.',
          ),
          severity: 'error',
        }),
      );
      expect(unhandledRejections).toHaveLength(0);
    });

    // Empty JSON body ({}) falls back to workflow not found message on 404
    it('404 with empty JSON body posts alert with detailed workflow message', async () => {
      mockFetchApi.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({}),
        text: async () => '{}',
      });

      renderWithRouter(<Workflows />);

      const buildButton = screen.getByTestId('split-button');
      fireEvent.click(buildButton);

      await waitFor(() => {
        expect(mockAlertApi.post).toHaveBeenCalledTimes(1);
      });
      expect(mockAlertApi.post).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining(
            'The referenced workflow "my-workflow" no longer exists. Please select or configure a new build workflow.',
          ),
          severity: 'error',
        }),
      );
      expect(unhandledRejections).toHaveLength(0);
    });

    // Non-404 error with empty JSON body falls back to HTTP status
    it('500 with empty JSON body posts alert with fallback HTTP status message', async () => {
      mockFetchApi.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({}),
        text: async () => '{}',
      });

      renderWithRouter(<Workflows />);

      const buildButton = screen.getByTestId('split-button');
      fireEvent.click(buildButton);

      await waitFor(() => {
        expect(mockAlertApi.post).toHaveBeenCalledTimes(1);
      });
      expect(mockAlertApi.post).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('HTTP 500: Internal Server Error'),
          severity: 'error',
        }),
      );
      expect(unhandledRejections).toHaveLength(0);
    });
  });

  describe('Build with Params error handling', () => {
    it('404 shows friendly message in dialog, not generic HTTP status', async () => {
      mockUseWorkflowData.mockReturnValue({
        builds: [],
        componentDetails: {
          componentWorkflow: {
            name: 'my-workflow',
            kind: 'Workflow',
            parameters: {},
          },
        },
        loading: false,
        error: null,
        fetchBuilds: jest.fn(),
        fetchComponentDetails: jest.fn(),
      });

      // First fetch call is from the schema fetch (if any); the params-dialog
      // trigger will be the next one.
      mockFetchApi.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ code: 'NOT_FOUND', error: 'Workflow not found' }),
        text: async () =>
          JSON.stringify({ code: 'NOT_FOUND', error: 'Workflow not found' }),
      });

      renderWithRouter(<Workflows />);

      // Click "Build with Custom Parameters" to open the dialog
      const customButton = screen.getByTestId('split-button-custom');
      fireEvent.click(customButton);

      // Dialog should appear
      await waitFor(() => {
        expect(screen.getByTestId('params-dialog')).toBeInTheDocument();
      });

      // Click the trigger button inside the mock dialog
      const triggerButton = screen.getByTestId('params-trigger');
      fireEvent.click(triggerButton);

      // The dialog should render the friendly error, not "HTTP 404: Not Found"
      await waitFor(() => {
        expect(screen.getByTestId('params-dialog-error')).toBeInTheDocument();
      });
      expect(screen.getByTestId('params-dialog-error')).toHaveTextContent(
        'The referenced workflow "my-workflow" no longer exists. Please select or configure a new build workflow.',
      );
      // Must NOT show the generic HTTP status message
      expect(screen.getByTestId('params-dialog-error').textContent).not.toContain(
        'HTTP 404',
      );
      // No toast — the dialog owns the error display
      expect(mockAlertApi.post).not.toHaveBeenCalled();
    });
  });
});
