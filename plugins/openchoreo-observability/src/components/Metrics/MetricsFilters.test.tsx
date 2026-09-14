import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MetricsFilters } from './MetricsFilters';
import { Filters } from '../../types';
import { Environment } from '@openchoreo/backstage-plugin-react';

// ---- Helpers ----

const environments: Environment[] = [
  {
    name: 'development',
    namespace: 'dev-ns',
    displayName: 'Development',
  },
  {
    name: 'staging',
    namespace: 'stg-ns',
    displayName: 'Staging',
  },
];

const baseFilters: Filters = {
  environment: environments[0],
  timeRange: '1h',
};

function renderFilters(
  overrides: Partial<React.ComponentProps<typeof MetricsFilters>> = {},
) {
  const defaultProps = {
    filters: baseFilters,
    onFiltersChange: jest.fn(),
    environments,
    disabled: false,
  };

  return {
    ...render(<MetricsFilters {...defaultProps} {...overrides} />),
    props: { ...defaultProps, ...overrides },
  };
}

// ---- Tests ----

describe('MetricsFilters', () => {
  it('renders environment selector', () => {
    renderFilters();

    // MUI outlined Select renders label text twice
    expect(screen.getAllByText('Environment').length).toBeGreaterThanOrEqual(1);
  });

  it('renders time range selector', () => {
    renderFilters();

    expect(screen.getAllByText('Time Range').length).toBeGreaterThanOrEqual(1);
  });

  it('disables controls when disabled', () => {
    renderFilters({ disabled: true });

    // Verify both selects are disabled via MUI's disabled class
    const disabledSelects = document.querySelectorAll(
      '.MuiInputBase-root.Mui-disabled',
    );
    expect(disabledSelects.length).toBeGreaterThanOrEqual(2);
  });
});

describe('component selector', () => {
  const components = [
    { uid: '1', name: 'api', displayName: 'API' },
    { uid: '2', name: 'worker', displayName: 'Worker' },
  ] as any;

  it('is hidden on the component page, which passes no components', () => {
    renderFilters();

    expect(screen.queryByText('Components')).not.toBeInTheDocument();
  });

  it('is hidden for a project with no components', () => {
    renderFilters({ components: [] });

    expect(screen.queryByText('Components')).not.toBeInTheDocument();
  });

  it('renders once the project has components', () => {
    renderFilters({ components });

    expect(screen.getAllByText('Components').length).toBeGreaterThanOrEqual(1);
  });

  it('is hidden in the total view, where it would do nothing', () => {
    renderFilters({
      components,
      viewMode: 'total',
      onViewModeChange: jest.fn(),
    });

    expect(screen.queryByText('Components')).not.toBeInTheDocument();
  });

  it('appears in the breakdown view, which is what it narrows', () => {
    renderFilters({
      components,
      viewMode: 'breakdown',
      onViewModeChange: jest.fn(),
    });

    expect(screen.getAllByText('Components').length).toBeGreaterThanOrEqual(1);
  });

  // Matches RuntimeLogs/LogsFilter: no `displayEmpty`, so MUI skips
  // `renderValue` for an empty array and the "All" placeholder does not render.
  // Deliberately consistent with the Logs tab rather than individually correct.
  it('renders no placeholder text when nothing is selected', () => {
    renderFilters({ components });

    expect(screen.queryByText('All')).not.toBeInTheDocument();
  });

  it('lists the selected components by display name, as the rows do', () => {
    renderFilters({
      components,
      filters: { ...baseFilters, components: ['api', 'worker'] },
    });

    expect(screen.getByText('API, Worker')).toBeInTheDocument();
  });

  it('falls back to the name for a component with no display name', () => {
    renderFilters({
      components: [...components, { uid: '3', name: 'db' }] as any,
      filters: { ...baseFilters, components: ['api', 'db'] },
    });

    expect(screen.getByText('API, db')).toBeInTheDocument();
  });
});

describe('view control', () => {
  const components = [
    { uid: '1', name: 'api', displayName: 'API' },
    { uid: '2', name: 'worker', displayName: 'Worker' },
  ] as any;

  it('is absent on the component page, which passes no handler', () => {
    renderFilters();

    expect(
      screen.queryByRole('button', { name: 'By component' }),
    ).not.toBeInTheDocument();
  });

  it('offers the two views and marks the active one', () => {
    renderFilters({
      components,
      viewMode: 'breakdown',
      onViewModeChange: jest.fn(),
    });

    expect(screen.getByRole('button', { name: 'Project' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(
      screen.getByRole('button', { name: 'By component' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('reports the view the user picked', async () => {
    const user = userEvent.setup();
    const onViewModeChange = jest.fn();
    renderFilters({ components, viewMode: 'total', onViewModeChange });

    await user.click(screen.getByRole('button', { name: 'By component' }));

    expect(onViewModeChange).toHaveBeenCalledWith('breakdown');
  });

  // Re-clicking the active button would otherwise deselect it and leave the
  // group with no view at all.
  it('ignores a click on the view already showing', async () => {
    const user = userEvent.setup();
    const onViewModeChange = jest.fn();
    renderFilters({ components, viewMode: 'total', onViewModeChange });

    await user.click(screen.getByRole('button', { name: 'Project' }));

    expect(onViewModeChange).not.toHaveBeenCalled();
  });
});
