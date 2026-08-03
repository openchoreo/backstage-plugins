import { render, screen } from '@testing-library/react';
import { TracesFilters } from './TracesFilters';
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

const components = [
  { name: 'api-svc', uid: 'c1', displayName: 'API Service' },
  { name: 'web-app', uid: 'c2', displayName: 'Web App' },
];

const baseFilters: Filters = {
  environment: environments[0],
  timeRange: '1h',
};

function renderFilters(
  overrides: Partial<React.ComponentProps<typeof TracesFilters>> = {},
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
    ...render(<TracesFilters {...defaultProps} {...overrides} />),
    props: { ...defaultProps, ...overrides },
  };
}

// ---- Tests ----

describe('TracesFilters', () => {
  it('renders search trace ID field', () => {
    renderFilters();

    expect(
      screen.getByPlaceholderText('Enter Trace ID to search'),
    ).toBeInTheDocument();
  });

  it('renders components selector', () => {
    renderFilters();

    expect(screen.getAllByText('Components').length).toBeGreaterThanOrEqual(1);
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

  it('shows skeleton while components are loading', () => {
    renderFilters({ componentsLoading: true });

    // Skeleton replaces the select dropdown
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('shows skeleton while environments are loading', () => {
    renderFilters({ environmentsLoading: true });

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });
});
