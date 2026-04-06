import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlertsFilter } from './AlertsFilter';
import { AlertsFilters } from './types';

// ---- Helpers ----

const environments = [
  {
    name: 'development',
    displayName: 'Development',
    namespace: 'ns-dev',
    isProduction: false,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    name: 'staging',
    displayName: 'Staging',
    namespace: 'ns-stg',
    isProduction: false,
    createdAt: '2024-01-01T00:00:00Z',
  },
];

const baseFilters: AlertsFilters = {
  environment: 'development',
  timeRange: '1h',
  sortOrder: 'desc',
  severity: [],
  searchQuery: '',
};

function renderFilter(
  overrides: Partial<React.ComponentProps<typeof AlertsFilter>> = {},
) {
  const defaultProps = {
    filters: baseFilters,
    onFiltersChange: jest.fn(),
    environments,
    environmentsLoading: false,
    disabled: false,
  };

  return {
    ...render(<AlertsFilter {...defaultProps} {...overrides} />),
    props: { ...defaultProps, ...overrides },
  };
}

// ---- Tests ----

describe('AlertsFilter', () => {
  it('renders search input', () => {
    renderFilter();

    expect(screen.getByPlaceholderText('Search alerts...')).toBeInTheDocument();
  });

  it('renders severity selector', () => {
    renderFilter();

    // MUI outlined Select renders label text twice
    expect(screen.getAllByText('Severity').length).toBeGreaterThanOrEqual(1);
  });

  it('renders environment selector', () => {
    renderFilter();

    expect(screen.getAllByText('Environment').length).toBeGreaterThanOrEqual(1);
  });

  it('renders time range selector', () => {
    renderFilter();

    expect(screen.getAllByText('Time Range').length).toBeGreaterThanOrEqual(1);
  });

  it('disables controls when disabled', () => {
    renderFilter({ disabled: true });

    expect(screen.getByPlaceholderText('Search alerts...')).toBeDisabled();
  });

  it('allows typing in search field', async () => {
    const user = userEvent.setup();
    renderFilter();

    const input = screen.getByPlaceholderText('Search alerts...');
    await user.type(input, 'cpu');

    expect(input).toHaveValue('cpu');
  });
});
