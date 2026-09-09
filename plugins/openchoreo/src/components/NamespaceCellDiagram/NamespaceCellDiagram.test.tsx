import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NamespaceCellDiagram } from './NamespaceCellDiagram';

// ---- Mocks ----

jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: jest.fn(),
  catalogApiRef: { id: 'catalog' },
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('@backstage/core-plugin-api', () => ({
  useApi: jest.fn(),
  createApiRef: (def: { id: string }) => ({ id: def?.id ?? 'mock-api-ref' }),
  discoveryApiRef: { id: 'discovery' },
  fetchApiRef: { id: 'fetch' },
}));

jest.mock('@backstage/catalog-model', () => ({
  stringifyEntityRef: (e: any) =>
    `domain:${e?.metadata?.namespace}/${e?.metadata?.name}`,
}));

// Stub the diagram lib: render one clickable button per cell so we can drive
// the single-click navigation path without the real canvas.
jest.mock('@openchoreo/cell-diagram', () => ({
  CellDiagram: ({ organization, onComponentDoubleClick }: any) => (
    <div data-testid="namespace-cell-diagram-view">
      {organization?.projects?.map((p: any) => (
        <button
          key={p.id}
          data-testid={`cell-${p.id}`}
          onClick={() => onComponentDoubleClick?.(p.id)}
        >
          {p.id}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('@openchoreo/backstage-design-system', () => ({
  useChoreoTokens: () => ({ mode: 'light' }),
  PageLoader: () => <div data-testid="page-loader" />,
}));

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  EmptyState: ({ title, description, action }: any) => (
    <div data-testid="empty-state">
      <div>{title}</div>
      {description && <div>{description}</div>}
      {action && (
        <button onClick={action.onClick} aria-label={action.label}>
          {action.label}
        </button>
      )}
    </div>
  ),
}));

jest.mock('@material-ui/core/Box', () => ({ children, ...rest }: any) => (
  <div {...rest}>{children}</div>
));

// ---- Helpers ----

const { useEntity } = jest.requireMock('@backstage/plugin-catalog-react');
const { useApi } = jest.requireMock('@backstage/core-plugin-api');

const mockDomainEntity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Domain',
  metadata: { name: 'test-ns', namespace: 'default' },
  spec: {},
};

const mockCatalogApi = { getEntities: jest.fn() };

function setupMockClient(
  overrides: Partial<{ getNamespaceCellDiagramInfo: jest.Mock }> = {},
) {
  const mockClient = {
    getNamespaceCellDiagramInfo: jest.fn().mockResolvedValue({
      id: 'test-ns',
      name: 'test-ns',
      projects: [
        { id: 'proj-a', name: 'proj-a', components: [] },
        { id: 'proj-b', name: 'proj-b', components: [] },
      ],
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
  useEntity.mockReturnValue({ entity: mockDomainEntity });
  mockCatalogApi.getEntities.mockResolvedValue({
    items: [{ metadata: { name: 'proj-a', namespace: 'default' } }],
  });
});

describe('NamespaceCellDiagram', () => {
  it('renders one cell per project in the namespace', async () => {
    setupMockClient();

    await act(async () => {
      render(<NamespaceCellDiagram />);
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('namespace-cell-diagram-view'),
      ).toBeInTheDocument();
    });
    expect(screen.getByTestId('cell-proj-a')).toBeInTheDocument();
    expect(screen.getByTestId('cell-proj-b')).toBeInTheDocument();
  });

  it('navigates to a project cell-diagram tab when a cell is clicked', async () => {
    setupMockClient();

    await act(async () => {
      render(<NamespaceCellDiagram />);
    });

    const cell = await screen.findByTestId('cell-proj-a');
    await act(async () => {
      await userEvent.click(cell);
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/catalog/default/system/proj-a/cell-diagram',
      );
    });
  });

  it('shows an empty state when the namespace has no projects', async () => {
    setupMockClient({
      getNamespaceCellDiagramInfo: jest.fn().mockResolvedValue({
        id: 'test-ns',
        name: 'test-ns',
        projects: [],
      }),
    });

    await act(async () => {
      render(<NamespaceCellDiagram />);
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('namespace-cell-diagram-empty'),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
    expect(
      screen.queryByTestId('namespace-cell-diagram-view'),
    ).not.toBeInTheDocument();
  });

  it('shows a Retry empty state when the fetch fails, then recovers', async () => {
    const mockClient = setupMockClient({
      getNamespaceCellDiagramInfo: jest
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValue({
          id: 'test-ns',
          name: 'test-ns',
          projects: [{ id: 'proj-a', name: 'proj-a', components: [] }],
        }),
    });

    await act(async () => {
      render(<NamespaceCellDiagram />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId('namespace-cell-diagram-view'),
    ).not.toBeInTheDocument();

    const retry = screen.getByRole('button', { name: /retry/i });
    await act(async () => {
      await userEvent.click(retry);
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('namespace-cell-diagram-view'),
      ).toBeInTheDocument();
    });
    expect(mockClient.getNamespaceCellDiagramInfo).toHaveBeenCalledTimes(2);
  });
});
