import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogsFilter } from './LogsFilter';
import { LogEntryField, RuntimeLogsFilters } from './types';

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

const components = [
  { name: 'svc-a', displayName: 'Service A' },
  { name: 'svc-b', displayName: 'Service B' },
];

const baseFilters: RuntimeLogsFilters = {
  logLevel: [],
  selectedFields: [
    LogEntryField.Timestamp,
    LogEntryField.LogLevel,
    LogEntryField.Log,
  ],
  environment: 'development',
  timeRange: '1h',
  sortOrder: 'desc',
  searchQuery: '',
  isLive: false,
};

function renderFilter(
  overrides: Partial<React.ComponentProps<typeof LogsFilter>> = {},
) {
  const defaultProps = {
    filters: baseFilters,
    onFiltersChange: jest.fn(),
    environments,
    environmentsLoading: false,
    disabled: false,
  };

  return {
    ...render(<LogsFilter {...defaultProps} {...overrides} />),
    props: { ...defaultProps, ...overrides },
  };
}

// ---- Tests ----

describe('LogsFilter', () => {
  it('renders search input', () => {
    renderFilter();

    expect(screen.getByPlaceholderText('Search Logs...')).toBeInTheDocument();
  });

  it('renders environment selector', () => {
    renderFilter();

    // MUI outlined Select renders label text twice (InputLabel + outlined label)
    expect(screen.getAllByText('Environment').length).toBeGreaterThanOrEqual(1);
  });

  it('renders time range selector', () => {
    renderFilter();

    expect(screen.getAllByText('Time Range').length).toBeGreaterThanOrEqual(1);
  });

  it('renders log levels selector', () => {
    renderFilter();

    expect(screen.getAllByText('Log Levels').length).toBeGreaterThanOrEqual(1);
  });

  it('shows components filter when components are provided', () => {
    renderFilter({ components });

    expect(screen.getAllByText('Components').length).toBeGreaterThanOrEqual(1);
  });

  it('does not show components filter when no components', () => {
    renderFilter({ components: [] });

    expect(screen.queryByText('Components')).not.toBeInTheDocument();
  });

  it('shows selected fields filter when no components (component-level)', () => {
    renderFilter({ components: [] });

    expect(
      screen.getAllByText('Selected Fields').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('does not show selected fields when components are present (project-level)', () => {
    renderFilter({ components });

    expect(screen.queryByText('Selected Fields')).not.toBeInTheDocument();
  });

  it('disables all controls when disabled', () => {
    renderFilter({ disabled: true });

    expect(screen.getByPlaceholderText('Search Logs...')).toBeDisabled();
  });

  it('allows typing in search field', async () => {
    const user = userEvent.setup();
    renderFilter();

    const searchInput = screen.getByPlaceholderText('Search Logs...');
    await user.type(searchInput, 'error');

    expect(searchInput).toHaveValue('error');
  });
});
