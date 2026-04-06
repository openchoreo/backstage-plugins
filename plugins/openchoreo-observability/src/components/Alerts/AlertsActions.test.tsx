import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlertsActions } from './AlertsActions';
import { AlertsFilters } from './types';

// ---- Helpers ----

const baseFilters: AlertsFilters = {
  environment: 'env-1',
  timeRange: '1h',
  sortOrder: 'desc',
};

function renderActions(
  overrides: Partial<React.ComponentProps<typeof AlertsActions>> = {},
) {
  const defaultProps = {
    totalCount: 15,
    disabled: false,
    onRefresh: jest.fn(),
    filters: baseFilters,
    onFiltersChange: jest.fn(),
    lastUpdated: new Date('2024-06-01T10:00:00Z'),
  };

  return {
    ...render(<AlertsActions {...defaultProps} {...overrides} />),
    props: { ...defaultProps, ...overrides },
  };
}

// ---- Tests ----

describe('AlertsActions', () => {
  it('displays total alerts count', () => {
    renderActions();

    expect(screen.getByText('Total alerts: 15')).toBeInTheDocument();
  });

  it('displays last updated time', () => {
    renderActions();

    expect(screen.getByText(/Last updated at:/)).toBeInTheDocument();
  });

  it('shows "Newest First" when sort order is desc', () => {
    renderActions();

    expect(
      screen.getByRole('button', { name: /newest first/i }),
    ).toBeInTheDocument();
  });

  it('shows "Oldest First" when sort order is asc', () => {
    renderActions({
      filters: { ...baseFilters, sortOrder: 'asc' },
    });

    expect(
      screen.getByRole('button', { name: /oldest first/i }),
    ).toBeInTheDocument();
  });

  it('toggles sort order on click', async () => {
    const user = userEvent.setup();
    const onFiltersChange = jest.fn();
    renderActions({ onFiltersChange });

    await user.click(screen.getByRole('button', { name: /newest first/i }));

    expect(onFiltersChange).toHaveBeenCalledWith({ sortOrder: 'asc' });
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

    expect(
      screen.getByRole('button', { name: /newest first/i }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: /refresh/i })).toBeDisabled();
  });
});
