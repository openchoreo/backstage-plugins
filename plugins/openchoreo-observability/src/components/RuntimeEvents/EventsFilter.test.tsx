import { fireEvent, render, screen } from '@testing-library/react';
import { EventsFilter } from './EventsFilter';
import {
  RuntimeEventsFilters,
  SELECTED_FIELDS,
  EventEntryField,
} from './types';

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
] as any;

const baseFilters: RuntimeEventsFilters = {
  selectedFields: [...SELECTED_FIELDS],
  environment: 'development',
  timeRange: '1h',
  sortOrder: 'asc',
  isLive: false,
};

function renderFilter(
  overrides: Partial<React.ComponentProps<typeof EventsFilter>> = {},
) {
  const defaultProps = {
    filters: baseFilters,
    onFiltersChange: jest.fn(),
    environments,
    environmentsLoading: false,
    disabled: false,
  };

  return {
    ...render(<EventsFilter {...defaultProps} {...overrides} />),
    props: { ...defaultProps, ...overrides },
  };
}

// ---- Tests ----

describe('EventsFilter', () => {
  it('renders the selected fields selector', () => {
    renderFilter();
    expect(
      screen.getAllByText('Selected Fields').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('renders the environment selector', () => {
    renderFilter();
    expect(screen.getAllByText('Environment').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the time range selector', () => {
    renderFilter();
    expect(screen.getAllByText('Time Range').length).toBeGreaterThanOrEqual(1);
  });

  it('shows the currently selected fields', () => {
    renderFilter();
    expect(screen.getByText(SELECTED_FIELDS.join(', '))).toBeInTheDocument();
  });

  it('toggling a field off calls onFiltersChange while always keeping Message', async () => {
    const onFiltersChange = jest.fn();
    renderFilter({ onFiltersChange });

    // Open the multi-select (MUI v4 opens on mousedown of the trigger).
    fireEvent.mouseDown(screen.getByLabelText('Selected Fields'));

    // Deselect "Type".
    const typeOption = await screen.findByRole('option', { name: /type/i });
    fireEvent.click(typeOption);

    expect(onFiltersChange).toHaveBeenCalledTimes(1);
    const arg = onFiltersChange.mock.calls[0][0];
    expect(arg.selectedFields).toContain(EventEntryField.Message);
    expect(arg.selectedFields).not.toContain(EventEntryField.Type);
  });
});
