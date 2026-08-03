import { render, screen } from '@testing-library/react';
import { RCAFilters } from './RCAFilters';
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
  overrides: Partial<React.ComponentProps<typeof RCAFilters>> = {},
) {
  const defaultProps = {
    filters: baseFilters,
    onFiltersChange: jest.fn(),
    environments,
    environmentsLoading: false,
    disabled: false,
  };

  return {
    ...render(<RCAFilters {...defaultProps} {...overrides} />),
    props: { ...defaultProps, ...overrides },
  };
}

// ---- Tests ----

describe('RCAFilters', () => {
  it('renders search input', () => {
    renderFilters();

    expect(
      screen.getByPlaceholderText('Search RCA reports...'),
    ).toBeInTheDocument();
  });

  it('renders environment selector', () => {
    renderFilters();

    expect(screen.getAllByText('Environment').length).toBeGreaterThanOrEqual(1);
  });

  it('renders status selector', () => {
    renderFilters();

    expect(screen.getAllByText('Status').length).toBeGreaterThanOrEqual(1);
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

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });
});
