import { render, screen } from '@testing-library/react';
import { IncidentsFilter } from './IncidentsFilter';
import { IncidentsFilters } from './types';

// ---- Helpers ----

const environments = [
  { id: 'dev', name: 'Development', resourceName: 'development' },
  { id: 'stg', name: 'Staging', resourceName: 'staging' },
];

const components = [
  { name: 'api-svc', displayName: 'API Service' },
  { name: 'web-app', displayName: 'Web App' },
];

const baseFilters: IncidentsFilters = {
  environmentId: 'dev',
  timeRange: '1h',
};

function renderFilters(
  overrides: Partial<React.ComponentProps<typeof IncidentsFilter>> = {},
) {
  const defaultProps = {
    filters: baseFilters,
    onFiltersChange: jest.fn(),
    environments,
    environmentsLoading: false,
    components,
    componentsLoading: false,
    disabled: false,
  };

  return {
    ...render(<IncidentsFilter {...defaultProps} {...overrides} />),
    props: { ...defaultProps, ...overrides },
  };
}

// ---- Tests ----

describe('IncidentsFilter', () => {
  it('renders search input', () => {
    renderFilters();

    expect(
      screen.getByPlaceholderText('Search incidents...'),
    ).toBeInTheDocument();
  });

  it('renders components selector when components exist', () => {
    renderFilters();

    expect(screen.getAllByText('Components').length).toBeGreaterThanOrEqual(1);
  });

  it('does not render components selector when no components', () => {
    renderFilters({ components: [] });

    expect(screen.queryByText('Components')).not.toBeInTheDocument();
  });

  it('renders status selector', () => {
    renderFilters();

    expect(screen.getAllByText('Status').length).toBeGreaterThanOrEqual(1);
  });

  it('renders environment selector', () => {
    renderFilters();

    expect(screen.getAllByText('Environment').length).toBeGreaterThanOrEqual(1);
  });

  it('renders time range selector', () => {
    renderFilters();

    expect(screen.getAllByText('Time Range').length).toBeGreaterThanOrEqual(1);
  });

  it('disables controls when disabled', () => {
    renderFilters({ disabled: true });

    const selects = document.querySelectorAll('.Mui-disabled');
    expect(selects.length).toBeGreaterThan(0);
  });

  it('shows skeleton while environments are loading', () => {
    renderFilters({ environmentsLoading: true });

    expect(document.querySelector('.MuiSkeleton-root')).toBeInTheDocument();
  });
});
