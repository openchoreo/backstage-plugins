import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CellDiagram } from './CellDiagram';

// ---- Mocks ----

jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: jest.fn(),
  catalogApiRef: { id: 'catalog' },
}));

jest.mock('@backstage/core-plugin-api', () => ({
  useApi: jest.fn(),
  createApiRef: () => ({ id: 'mock-api-ref' }),
}));

jest.mock('@backstage/core-components', () => ({
  Progress: () => <div data-testid="progress">Loading...</div>,
}));

jest.mock('@wso2/cell-diagram', () => ({
  CellDiagram: ({ project }: any) => (
    <div data-testid="cell-diagram-view">{project?.id}</div>
  ),
}));

jest.mock('@openchoreo/backstage-design-system', () => ({
  useChoreoTokens: () => ({ mode: 'light' }),
}));

jest.mock('@material-ui/core/styles', () => ({
  useTheme: () => ({
    palette: { background: { paper: '#fff' } },
  }),
}));

// MUI components — minimal stubs
jest.mock('@material-ui/core/Box', () => ({ children, ...rest }: any) => (
  <div {...rest}>{children}</div>
));
jest.mock('@material-ui/core/FormControl', () => ({ children }: any) => (
  <div>{children}</div>
));
jest.mock('@material-ui/core/InputLabel', () => ({ children }: any) => (
  <label>{children}</label>
));
jest.mock('@material-ui/core/MenuItem', () => ({ children, value }: any) => (
  <option value={value}>{children}</option>
));
jest.mock(
  '@material-ui/core/Select',
  () =>
    ({ children, onChange, value, disabled }: any) =>
      (
        <select
          data-testid="select"
          onChange={e => onChange?.({ target: { value: e.target.value } })}
          value={value}
          disabled={disabled}
        >
          {children}
        </select>
      ),
);
jest.mock('@material-ui/core/Tooltip', () => ({ children }: any) => (
  <div>{children}</div>
));
jest.mock(
  '@material-ui/core/Typography',
  () =>
    ({ children, ...rest }: any) =>
      <span {...rest}>{children}</span>,
);
jest.mock('@material-ui/core/CircularProgress', () => () => (
  <div data-testid="spinner">loading</div>
));
jest.mock(
  '@material-ui/core/IconButton',
  () =>
    ({ children, onClick, disabled }: any) =>
      (
        <button onClick={onClick} disabled={disabled}>
          {children}
        </button>
      ),
);
jest.mock('@material-ui/icons/Refresh', () => () => <span>Refresh</span>);

// ---- Helpers ----

const { useEntity } = jest.requireMock('@backstage/plugin-catalog-react');
const { useApi } = jest.requireMock('@backstage/core-plugin-api');

const mockEntity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'System',
  metadata: {
    name: 'my-project',
    namespace: 'default',
    annotations: { 'openchoreo.io/namespace': 'test-ns' },
  },
  spec: {},
};

const mockCatalogApi = {
  getEntities: jest.fn().mockResolvedValue({
    items: [{ metadata: { name: 'dev' } }, { metadata: { name: 'prod' } }],
  }),
};

function setupMockClient(
  overrides: Partial<{
    getCellDiagramInfo: jest.Mock;
  }> = {},
) {
  const mockClient = {
    getCellDiagramInfo: jest.fn().mockResolvedValue({
      id: 'my-project',
      components: [],
      connections: [],
    }),
    ...overrides,
  };
  useApi.mockImplementation((ref: { id: string }) => {
    if (ref.id === 'catalog') return mockCatalogApi;
    return mockClient;
  });
  return mockClient;
}

beforeEach(() => {
  jest.clearAllMocks();
  useEntity.mockReturnValue({ entity: mockEntity });
  mockCatalogApi.getEntities.mockResolvedValue({
    items: [{ metadata: { name: 'dev' } }, { metadata: { name: 'prod' } }],
  });
});

describe('CellDiagram', () => {
  it('renders the cell diagram after loading environments and data', async () => {
    const mockClient = setupMockClient();

    await act(async () => {
      render(<CellDiagram />);
    });

    await waitFor(() => {
      expect(mockCatalogApi.getEntities).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: { kind: 'Environment', 'metadata.namespace': 'test-ns' },
        }),
      );
      expect(mockClient.getCellDiagramInfo).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId('cell-diagram-view')).toBeInTheDocument();
    });
  });

  it('shows Progress while data loads', async () => {
    // make getCellDiagramInfo never resolve so we stay in loading state
    setupMockClient({
      getCellDiagramInfo: jest.fn(() => new Promise(() => {})),
    });

    render(<CellDiagram />);

    // Initial render shows Progress (cellDiagramData is undefined)
    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('renders environment selector with returned environments', async () => {
    setupMockClient();

    await act(async () => {
      render(<CellDiagram />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('cell-diagram-view')).toBeInTheDocument();
    });

    // Both env options should be present in the selector
    expect(screen.getByText('dev')).toBeInTheDocument();
    expect(screen.getByText('prod')).toBeInTheDocument();
  });

  it('shows no-traffic hint when project has no observations', async () => {
    setupMockClient({
      getCellDiagramInfo: jest.fn().mockResolvedValue({
        id: 'my-project',
        components: [
          {
            id: 'svc',
            services: {
              main: {
                deploymentMetadata: {
                  gateways: { internet: { observations: [] } },
                },
              },
            },
          },
        ],
        connections: [],
      }),
    });

    await act(async () => {
      render(<CellDiagram />);
    });

    await waitFor(() => {
      expect(screen.getByText(/No HTTP traffic/i)).toBeInTheDocument();
    });
  });

  it('does not show no-traffic hint when observations are present', async () => {
    setupMockClient({
      getCellDiagramInfo: jest.fn().mockResolvedValue({
        id: 'my-project',
        components: [
          {
            id: 'svc',
            services: {
              main: {
                deploymentMetadata: {
                  gateways: {
                    internet: {
                      isExposed: true,
                      observations: [{ requestCount: 10 }],
                    },
                  },
                },
              },
            },
          },
        ],
        connections: [],
      }),
    });

    await act(async () => {
      render(<CellDiagram />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('cell-diagram-view')).toBeInTheDocument();
    });

    expect(screen.queryByText(/No HTTP traffic/i)).not.toBeInTheDocument();
  });

  it('increments refresh nonce when Refresh button is clicked', async () => {
    const mockClient = setupMockClient();

    await act(async () => {
      render(<CellDiagram />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('cell-diagram-view')).toBeInTheDocument();
    });

    const refreshButton = screen.getByRole('button');

    await act(async () => {
      await userEvent.click(refreshButton);
    });

    await waitFor(() => {
      expect(mockClient.getCellDiagramInfo).toHaveBeenCalledTimes(2);
    });
  });
});
