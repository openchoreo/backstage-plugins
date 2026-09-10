import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  PlatformLogsToolbar,
  planeScope,
  planeScopeShort,
} from './PlatformLogsToolbar';
import {
  DEFAULT_PLATFORM_LOG_FIELDS,
  PLATFORM_LOG_LEVELS,
  PlatformLogsFilters,
} from './types';

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  ...jest.requireActual('@openchoreo/backstage-plugin-react'),
  TimeRangeFilter: () => <div data-testid="time-range" />,
}));

const base = (
  over: Partial<PlatformLogsFilters> = {},
): PlatformLogsFilters => ({
  observabilityPlane: 'default',
  selectedFields: DEFAULT_PLATFORM_LOG_FIELDS,
  clusterInstances: [],
  namespaces: [],
  podNames: [],
  containerNames: [],
  labels: '',
  logLevel: [...PLATFORM_LOG_LEVELS],
  timeRange: '10m',
  sortOrder: 'desc',
  ...over,
});

const clusterPlane = {
  ref: 'clusterobservabilityplane:default/default',
  displayName: 'default',
  kind: 'ClusterObservabilityPlane',
  namespace: 'default',
  observerUrl: 'http://c',
};

const planes = [
  {
    ref: 'observabilityplane:default/default',
    displayName: 'default',
    kind: 'ObservabilityPlane',
    namespace: 'default',
    observerUrl: 'http://o',
  },
];

const renderToolbar = (
  filters: PlatformLogsFilters = base(),
  over: Partial<Parameters<typeof PlatformLogsToolbar>[0]> = {},
) => {
  const onFiltersChange = jest.fn();
  const onToggleFilters = jest.fn();
  const onRefresh = jest.fn();
  const { container } = render(
    <PlatformLogsToolbar
      filters={filters}
      onFiltersChange={onFiltersChange}
      planes={planes}
      planesLoading={false}
      filtersOpen={false}
      onToggleFilters={onToggleFilters}
      onRefresh={onRefresh}
      {...over}
    />,
  );
  return { onFiltersChange, onToggleFilters, onRefresh, container };
};

describe('PlatformLogsToolbar', () => {
  it('keeps the plane, time range, search and actions always visible', () => {
    renderToolbar();

    expect(screen.getByLabelText('Observability Plane')).toBeInTheDocument();
    expect(screen.getByTestId('time-range')).toBeInTheDocument();
    expect(screen.getByLabelText('Search log messages')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Filters/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Live/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('toggles the filter row and reports its state', async () => {
    const { onToggleFilters } = renderToolbar(base(), { filtersOpen: false });

    const button = screen.getByRole('button', { name: /Filters/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(button);

    expect(onToggleFilters).toHaveBeenCalled();
  });

  // The whole point of collapsing by default: the count has to say how much is hidden.
  it('counts the applied filters on the trigger', () => {
    renderToolbar(base({ namespaces: ['thunder'], logLevel: ['ERROR'] }));

    expect(screen.getByRole('button', { name: /Filters/ })).toHaveTextContent(
      '2',
    );
  });

  it('shows no count when nothing is applied', () => {
    renderToolbar();

    expect(
      screen.getByRole('button', { name: /Filters/ }),
    ).not.toHaveTextContent(/\d/);
  });

  it('summarises applied filters as chips even while the row is collapsed', () => {
    renderToolbar(base({ namespaces: ['thunder'], podNames: ['a', 'b'] }));

    expect(screen.getByText('Namespace: thunder')).toBeInTheDocument();
    expect(screen.getByText('Pod: 2')).toBeInTheDocument();
  });

  it('clears one filter from its chip', async () => {
    const { onFiltersChange, container } = renderToolbar(
      base({ namespaces: ['thunder'] }),
    );

    // MUI v4 gives the delete affordance no role or test id, only a class.
    const remove = container.querySelector('.MuiChip-deleteIcon');
    expect(remove).not.toBeNull();
    await userEvent.click(remove as Element);

    expect(onFiltersChange).toHaveBeenCalledWith({ namespaces: [] });
  });

  it('clears every filter at once', async () => {
    const { onFiltersChange } = renderToolbar(
      base({ namespaces: ['thunder'], labels: 'a=b' }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));

    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ namespaces: [], labels: '' }),
    );
  });

  // Search is the one filter with no chip, so the field itself is the only way to
  // clear it.
  it('offers no clear button while the search is empty', () => {
    renderToolbar();

    expect(
      screen.queryByRole('button', { name: 'Clear search' }),
    ).not.toBeInTheDocument();
  });

  it('clears the search from its button', async () => {
    const { onFiltersChange } = renderToolbar(
      base({ searchQuery: 'reconcile' }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(onFiltersChange).toHaveBeenCalledWith({ searchQuery: '' });
  });

  it('toggles live tail', async () => {
    const { onFiltersChange } = renderToolbar();

    await userEvent.click(screen.getByRole('button', { name: /Live/ }));

    expect(onFiltersChange).toHaveBeenCalledWith({ isLive: true });
  });

  // A custom range has a fixed upper bound, so polling it returns the same rows
  // forever — an enabled button that does nothing is worse than a disabled one.
  it('disables live tail on a custom time range', () => {
    renderToolbar(base({ timeRange: 'custom' }));

    expect(screen.getByRole('button', { name: /Live/ })).toBeDisabled();
  });

  it('refreshes on demand', async () => {
    const { onRefresh } = renderToolbar();

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(onRefresh).toHaveBeenCalled();
  });
});

// Both kinds are listed together and both are commonly named "default", so the name
// alone leaves the picker showing two identical rows.
describe('plane scope labels', () => {
  it('names the kind of a cluster-scoped plane', () => {
    expect(planeScope(clusterPlane)).toBe('ClusterObservabilityPlane');
    expect(planeScopeShort(clusterPlane)).toBe('cluster');
  });

  it('adds the namespace for a namespaced plane', () => {
    expect(planeScope(planes[0])).toBe('ObservabilityPlane · default');
    expect(planeScopeShort(planes[0])).toBe('ns: default');
  });

  it('tells two same-named planes apart', () => {
    expect(planeScope(planes[0])).not.toBe(planeScope(clusterPlane));
    expect(planeScopeShort(planes[0])).not.toBe(planeScopeShort(clusterPlane));
  });
});

describe('PlatformLogsToolbar plane picker', () => {
  it('shows the scope beside the name in the closed field', () => {
    renderToolbar(base({ observabilityPlane: clusterPlane.ref }), {
      planes: [...planes, clusterPlane],
    });

    expect(screen.getByText('default (cluster)')).toBeInTheDocument();
  });

  it('distinguishes same-named planes in the open list', async () => {
    renderToolbar(base(), { planes: [...planes, clusterPlane] });

    await userEvent.click(
      screen.getByRole('button', { name: /Observability Plane/ }),
    );

    expect(
      screen.getByText('ObservabilityPlane · default'),
    ).toBeInTheDocument();
    expect(screen.getByText('ClusterObservabilityPlane')).toBeInTheDocument();
  });
});
