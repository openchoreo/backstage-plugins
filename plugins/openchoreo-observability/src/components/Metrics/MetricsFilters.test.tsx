import { render, screen } from '@testing-library/react';
import { MetricsFilters } from './MetricsFilters';
import { Environment, Filters } from '../../types';

// ---- Helpers ----

const environments: Environment[] = [
  {
    uid: 'env-1',
    name: 'development',
    namespace: 'dev-ns',
    displayName: 'Development',
    isProduction: false,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    uid: 'env-2',
    name: 'staging',
    namespace: 'stg-ns',
    displayName: 'Staging',
    isProduction: false,
    createdAt: '2024-01-01T00:00:00Z',
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
    expect(
      screen.getAllByText('Environment').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('renders time range selector', () => {
    renderFilters();

    expect(
      screen.getAllByText('Time Range').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('disables controls when disabled', () => {
    renderFilters({ disabled: true });

    // The environment and time range selects should be disabled
    const selects = document.querySelectorAll('.Mui-disabled');
    expect(selects.length).toBeGreaterThan(0);
  });
});
