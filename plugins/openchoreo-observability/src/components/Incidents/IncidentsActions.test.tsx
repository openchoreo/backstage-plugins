import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IncidentsActions } from './IncidentsActions';
import { IncidentsFilters } from './types';

// ---- Helpers ----

const baseFilters: IncidentsFilters = {
  environment: 'dev',
  timeRange: '1h',
};

function renderActions(
  overrides: Partial<React.ComponentProps<typeof IncidentsActions>> = {},
) {
  const defaultProps = {
    totalCount: 5,
    disabled: false,
    onRefresh: jest.fn(),
    filters: baseFilters,
    onFiltersChange: jest.fn(),
    lastUpdated: new Date('2024-06-01T10:00:00Z'),
  };

  return {
    ...render(<IncidentsActions {...defaultProps} {...overrides} />),
    props: { ...defaultProps, ...overrides },
  };
}

// ---- Tests ----

describe('IncidentsActions', () => {
  it('displays total incidents count', () => {
    renderActions();

    expect(screen.getByText('Total incidents: 5')).toBeInTheDocument();
  });

  it('displays last updated text', () => {
    renderActions();

    expect(screen.getByText(/Last updated at:/)).toBeInTheDocument();
  });

  it('shows sort button defaulting to Newest First', () => {
    renderActions();

    expect(screen.getByText('Newest First')).toBeInTheDocument();
  });

  it('toggles sort order on click', async () => {
    const user = userEvent.setup();
    const onFiltersChange = jest.fn();
    renderActions({ onFiltersChange });

    await user.click(screen.getByText('Newest First'));

    expect(onFiltersChange).toHaveBeenCalledWith({ sortOrder: 'asc' });
  });

  it('shows Oldest First when sortOrder is asc', () => {
    renderActions({
      filters: { ...baseFilters, sortOrder: 'asc' },
    });

    expect(screen.getByText('Oldest First')).toBeInTheDocument();
  });

  it('calls onRefresh when Refresh is clicked', async () => {
    const user = userEvent.setup();
    const onRefresh = jest.fn();
    renderActions({ onRefresh });

    await user.click(screen.getByRole('button', { name: /refresh/i }));

    expect(onRefresh).toHaveBeenCalled();
  });

  it('disables buttons when disabled', () => {
    renderActions({ disabled: true });

    expect(screen.getByRole('button', { name: /refresh/i })).toBeDisabled();
  });
});
