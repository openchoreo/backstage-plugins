import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, type Theme } from '@material-ui/core/styles';
import { openChoreoTheme } from '@openchoreo/backstage-design-system';
import type { Entity } from '@backstage/catalog-model';
import { CompactEntityHeader } from './CompactEntityHeader';

// The unified theme's `getTheme('v4')` is typed as a union of supported MUI
// versions; the header's makeStyles needs the v4 shape (theme.page.fontColor),
// so narrow it here for the provider.
const v4Theme = openChoreoTheme.getTheme('v4') as unknown as Theme;

// Drive the sibling-list query directly so we can supply cached data without a
// real network/QueryClient. Each test overrides the return value.
const useOpenChoreoQueryMock = jest.fn();
jest.mock('../../hooks/useOpenChoreoQuery', () => ({
  useOpenChoreoQuery: (...args: unknown[]) => useOpenChoreoQueryMock(...args),
}));

// The refresh spinner is gated on `useIsFetching` (the inner CachingCatalogApi
// getEntities query), NOT the outer query's isRefetching — so drive that flag
// directly. `useUserScopedKey` needs the provider context we don't mount, so
// stub it to a plain prefixer.
const useIsFetchingMock = jest.fn<number, unknown[]>(() => 0);
jest.mock('@tanstack/react-query', () => ({
  useIsFetching: (...args: unknown[]) => useIsFetchingMock(...args),
}));
jest.mock('../../query/OpenChoreoQueryProvider', () => ({
  useUserScopedKey: () => (key: unknown[]) => ['@user', 'u', ...key],
}));

// The header pulls the catalog API and resolves parent/ancestor titles via
// react-use's useAsync; stub both so no provider/network is needed.
jest.mock('@backstage/core-plugin-api', () => ({
  useApi: () => ({ getEntityByRef: jest.fn().mockResolvedValue(undefined) }),
}));
jest.mock('react-use/esm/useAsync', () => ({
  __esModule: true,
  default: () => ({ value: undefined, loading: false }),
}));
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

// Catalog-react display helpers need app/entity context we don't supply; render
// simple stand-ins so the header itself is what's under test.
jest.mock('@backstage/plugin-catalog-react', () => ({
  catalogApiRef: { id: 'catalog' },
  EntityDisplayName: ({ entityRef }: { entityRef: Entity }) => (
    <span>{entityRef.metadata.name}</span>
  ),
  FavoriteEntity: () => <span data-testid="favorite" />,
}));

const componentEntity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'payment-service', namespace: 'default' },
  spec: { type: 'service' },
};

const sibling = (name: string): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name, namespace: 'default' },
});

const renderHeader = () =>
  render(
    <ThemeProvider theme={v4Theme}>
      <CompactEntityHeader
        entity={componentEntity}
        headerTitle="payment-service"
        kind="component"
        entityName="payment-service"
      />
    </ThemeProvider>,
  );

/** Open the current level's sibling menu by clicking its caret button. */
const openBreadcrumbMenu = () => {
  fireEvent.click(screen.getByLabelText('Open breadcrumb quick navigation'));
};

describe('CompactEntityHeader breadcrumb refresh indicator', () => {
  afterEach(() => {
    useOpenChoreoQueryMock.mockReset();
    useIsFetchingMock.mockReset();
    useIsFetchingMock.mockReturnValue(0);
  });

  it('shows the refresh spinner while an already-cached sibling list revalidates', () => {
    // Cached data present AND the inner getEntities query is fetching.
    useOpenChoreoQueryMock.mockReturnValue({
      data: { items: [sibling('payment-service'), sibling('order-service')] },
      loading: false,
    });
    useIsFetchingMock.mockReturnValue(1);

    renderHeader();
    openBreadcrumbMenu();

    // The inline spinner renders role="status" with the level's plural label.
    const overlay = screen.getByRole('status');
    expect(overlay).toHaveAttribute('aria-label', 'Refreshing components');
    // The cached items stay visible next to the spinner.
    expect(screen.getByText('order-service')).toBeInTheDocument();
  });

  it('does not show the spinner when the inner query is not fetching', () => {
    useOpenChoreoQueryMock.mockReturnValue({
      data: { items: [sibling('payment-service')] },
      loading: false,
    });
    useIsFetchingMock.mockReturnValue(0);

    renderHeader();
    openBreadcrumbMenu();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the first-load item (not the spinner) on the initial fetch', () => {
    // First load: no cached data yet, loading true. Even if a fetch is counted,
    // the "Loading resources..." item owns the menu and there is no cached list
    // to overlay a refresh spinner on.
    useOpenChoreoQueryMock.mockReturnValue({
      data: undefined,
      loading: true,
    });
    useIsFetchingMock.mockReturnValue(0);

    renderHeader();
    openBreadcrumbMenu();

    expect(screen.getByText('Loading resources...')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
