import { render, screen } from '@testing-library/react';
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
