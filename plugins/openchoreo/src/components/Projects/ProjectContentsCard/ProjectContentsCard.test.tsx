import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { mockSystemEntity } from '@openchoreo/test-utils';
import { ProjectContentsCard } from './ProjectContentsCard';

// ---- Mocks ----

const mockUseProjectContentsPage = jest.fn();
const mockUseProjectContentFacets = jest.fn();
const mockUseEnvironments = jest.fn();
const mockUseDeploymentPipeline = jest.fn();
jest.mock('../hooks', () => ({
  useProjectContentsPage: (...args: any[]) =>
    mockUseProjectContentsPage(...args),
  useProjectContentFacets: (...args: any[]) =>
    mockUseProjectContentFacets(...args),
  useEnvironments: (...args: any[]) => mockUseEnvironments(...args),
  useDeploymentPipeline: () => mockUseDeploymentPipeline(),
}));

const mockUseReleaseBindingPermission = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useReleaseBindingPermission: () => mockUseReleaseBindingPermission(),
  formatRelativeTime: (iso: string) => `rel(${iso})`,
}));

// Pulls in scaffolder route refs / permission hooks; stub for this card test.
jest.mock('./CreateProjectContentButton', () => ({
  CreateProjectContentButton: () => (
    <button type="button">Create Content</button>
  ),
}));

jest.mock('@backstage/core-plugin-api', () => ({
  ...jest.requireActual('@backstage/core-plugin-api'),
  useApp: () => ({
    getSystemIcon: () => () => <span data-testid="kind-icon" />,
  }),
}));

jest.mock('@backstage/core-components', () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  Table: ({ data, columns, emptyContent }: any) => (
    <div data-testid="table">
      {data.length === 0 ? (
        emptyContent
      ) : (
        <table>
          <tbody>
            {data.map((row: any) => (
              <tr key={row.name} data-testid="table-row">
                {columns.map((col: any) => (
                  <td key={col.title}>
                    {col.render ? col.render(row) : row[col.field]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  ),
  TableColumn: {},
}));

jest.mock('../../DeleteEntity', () => ({
  isMarkedForDeletion: () => false,
  DeletionBadge: () => null,
}));
jest.mock('../../../utils/errorUtils', () => ({
  isForbiddenError: () => false,
}));
jest.mock('../../../utils/shouldNavigateOnRowClick', () => ({
  shouldNavigateOnRowClick: () => true,
}));

// ---- Helpers ----

const item = (kind: 'component' | 'resource', name: string, type: string) => ({
  entity: {
    apiVersion: 'backstage.io/v1alpha1',
    kind: kind === 'component' ? 'Component' : 'Resource',
    metadata: { name, namespace: 'default' },
    spec: { type },
  },
  kind,
  name,
  displayName: name,
  type,
  description: `${name} description`,
  deploymentStatus: {},
  deploymentLoaded: true,
  createdAt: '2026-05-01T00:00:00Z',
});

const testEntity = mockSystemEntity({ name: 'test-project' });

function renderCard() {
  return render(
    <MemoryRouter>
      <EntityProvider entity={testEntity}>
        <ProjectContentsCard />
      </EntityProvider>
    </MemoryRouter>,
  );
}

const setup = (
  items: ReturnType<typeof item>[],
  page: Partial<{ totalItems: number; nextCursor?: string }> = {},
) => {
  mockUseProjectContentsPage.mockReturnValue({
    items,
    totalItems: page.totalItems ?? items.length,
    prevCursor: undefined,
    nextCursor: page.nextCursor,
    loading: false,
    error: null,
  });
  mockUseProjectContentFacets.mockReturnValue({
    counts: {
      all: 7,
      component: items.filter(i => i.kind === 'component').length,
      resource: items.filter(i => i.kind === 'resource').length,
    },
    typesByKind: { component: ['deployment/service'], resource: ['postgres'] },
    loading: false,
  });
  mockUseEnvironments.mockReturnValue({ environments: [], loading: false });
  mockUseDeploymentPipeline.mockReturnValue({
    data: { environments: [] },
    loading: false,
    error: null,
  });
  mockUseReleaseBindingPermission.mockReturnValue({
    canViewBindings: true,
    loading: false,
  });
};

// ---- Tests ----

describe('ProjectContentsCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the title with the project-wide count and the page rows', () => {
    setup(
      [
        item('component', 'snip-api', 'deployment/service'),
        item('resource', 'snip-postgres', 'postgres'),
      ],
      { totalItems: 7 },
    );

    renderCard();

    expect(screen.getByText('Project Contents')).toBeInTheDocument();
    // Count badge reflects the project-wide facet total (also shown on the
    // "All" chip, hence getAllByText).
    expect(screen.getAllByText('7').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('table-row')).toHaveLength(2);
    expect(screen.getByText('snip-api')).toBeInTheDocument();
    expect(screen.getByText('snip-postgres')).toBeInTheDocument();
  });

  it('renders the Kind and Type filter dropdowns', () => {
    setup([
      item('component', 'snip-api', 'deployment/service'),
      item('resource', 'snip-postgres', 'postgres'),
    ]);
    renderCard();
    expect(screen.getByLabelText('Filter by kind')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by type')).toBeInTheDocument();
  });

  it('shows an empty state when the page has no rows', () => {
    setup([], { totalItems: 0 });
    renderCard();
    expect(
      screen.getByText('No components or resources match the current filters'),
    ).toBeInTheDocument();
  });

  it('shows a card skeleton (not the table) on the initial load', () => {
    // Facets still resolving: we don't yet know if this becomes a table or the
    // empty state, so the whole card reads as a skeleton — no title, no table.
    mockUseProjectContentsPage.mockReturnValue({
      items: [],
      totalItems: 0,
      loading: true,
      error: null,
    });
    mockUseProjectContentFacets.mockReturnValue({
      counts: { all: 0, component: 0, resource: 0 },
      typesByKind: { component: [], resource: [] },
      loading: true,
    });
    mockUseEnvironments.mockReturnValue({ environments: [], loading: false });
    mockUseDeploymentPipeline.mockReturnValue({
      data: { environments: [] },
      loading: false,
      error: null,
    });
    mockUseReleaseBindingPermission.mockReturnValue({
      canViewBindings: true,
      loading: false,
    });

    renderCard();

    expect(screen.queryByTestId('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Project Contents')).not.toBeInTheDocument();
    expect(
      document.querySelectorAll('[aria-hidden="true"]').length,
    ).toBeGreaterThan(0);
  });

  it('keeps the table mounted during a refetch after the first load', () => {
    // Once the card has loaded, a subsequent refetch (page.loading true) must
    // keep the table and header controls mounted rather than collapsing back to
    // the skeleton — even if the refetch momentarily has no rows.
    setup([item('component', 'snip-api', 'deployment/service')], {
      totalItems: 7,
    });
    const { rerender } = renderCard();
    expect(screen.getByTestId('table')).toBeInTheDocument();

    // Now a refetch is in flight (loading true, prior rows retained).
    mockUseProjectContentsPage.mockReturnValue({
      items: [item('component', 'snip-api', 'deployment/service')],
      totalItems: 7,
      prevCursor: undefined,
      nextCursor: undefined,
      loading: true,
      error: null,
    });
    rerender(
      <MemoryRouter>
        <EntityProvider entity={testEntity}>
          <ProjectContentsCard />
        </EntityProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('table')).toBeInTheDocument();
    expect(screen.getByText('snip-api')).toBeInTheDocument();
  });

  it('renders the cursor pager with range and an enabled Next when more pages exist', () => {
    setup(
      [
        item('component', 'snip-api', 'deployment/service'),
        item('component', 'snip-frontend', 'deployment/web-application'),
      ],
      { totalItems: 7, nextCursor: 'CURSOR_2' },
    );

    renderCard();

    expect(screen.getByText('1–2 of 7')).toBeInTheDocument();
    expect(screen.getByLabelText('Next page')).toBeEnabled();
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
  });
});
