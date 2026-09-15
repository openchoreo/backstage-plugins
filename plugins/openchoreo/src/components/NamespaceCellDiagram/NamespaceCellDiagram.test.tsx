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

// Stub the diagram lib: in org mode render one clickable button per cell
// (with id={p.id}, matching the real lib, so the preview can anchor to it); in
// project mode render a preview marker.
jest.mock('@openchoreo/cell-diagram', () => ({
  CellDiagram: ({ organization, project, onComponentDoubleClick }: any) => {
    if (project) {
      return (
        <div data-testid={`preview-${project.id}`}>{project.id} preview</div>
      );
    }
    return (
      <div data-testid="namespace-cell-diagram-view">
        {organization?.projects?.map((p: any) => (
          <button
            key={p.id}
            id={p.id}
            data-testid={`cell-${p.id}`}
            onClick={() => onComponentDoubleClick?.(p.id)}
          >
            {p.id}
          </button>
        ))}
      </div>
    );
  },
}));

// Minimal MUI/Backstage stubs for the preview popover.
jest.mock('@material-ui/core/Popper', () => ({
  __esModule: true,
  default: ({ open, children }: any) =>
    open ? <div data-testid="preview-popover">{children}</div> : null,
}));
jest.mock('@material-ui/core/Paper', () => ({ children }: any) => (
  <div data-testid="preview-panel">{children}</div>
));
jest.mock(
  '@material-ui/core/ClickAwayListener',
  () =>
    ({ children }: any) =>
      children,
);
jest.mock('@material-ui/core/Typography', () => ({ children }: any) => (
  <span>{children}</span>
));
jest.mock('@material-ui/core/Button', () => ({ children, onClick }: any) => (
  <button onClick={onClick}>{children}</button>
));
jest.mock(
  '@material-ui/core/IconButton',
  () =>
    ({ children, onClick, ['aria-label']: ariaLabel }: any) =>
      (
        <button aria-label={ariaLabel} onClick={onClick}>
          {children}
        </button>
      ),
);
jest.mock('@material-ui/icons/Close', () => () => <span>close</span>);
jest.mock('@material-ui/icons/OpenInNew', () => () => <span>open</span>);
jest.mock('@backstage/core-components', () => ({
  Progress: () => <div data-testid="progress" />,
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
        {
          id: 'proj-a',
          name: 'proj-a',
          components: [{ id: 'svc-1', label: 'svc-1' }],
        },
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

  it('opens an in-place preview when a cell is clicked', async () => {
    setupMockClient();

    await act(async () => {
      render(<NamespaceCellDiagram />);
    });

    const cell = await screen.findByTestId('cell-proj-a');
    await act(async () => {
      await userEvent.click(cell);
    });

    // Preview panel renders that project's diagram + name; no navigation yet.
    await waitFor(() => {
      expect(screen.getByTestId('preview-proj-a')).toBeInTheDocument();
    });
    expect(screen.getByTestId('preview-project-name')).toHaveTextContent(
      'proj-a',
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates to the project cell-diagram tab from the preview', async () => {
    setupMockClient();

    await act(async () => {
      render(<NamespaceCellDiagram />);
    });

    const cell = await screen.findByTestId('cell-proj-a');
    await act(async () => {
      await userEvent.click(cell);
    });
    await screen.findByTestId('preview-proj-a');

    const openFull = screen.getByRole('button', { name: /go to project/i });
    await act(async () => {
      await userEvent.click(openFull);
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/catalog/default/system/proj-a/cell-diagram',
      );
    });
  });

  it('closes the preview via the close button', async () => {
    setupMockClient();

    await act(async () => {
      render(<NamespaceCellDiagram />);
    });

    const cell = await screen.findByTestId('cell-proj-a');
    await act(async () => {
      await userEvent.click(cell);
    });
    await screen.findByTestId('preview-proj-a');

    const close = screen.getByRole('button', { name: /close preview/i });
    await act(async () => {
      await userEvent.click(close);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('preview-proj-a')).not.toBeInTheDocument();
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
