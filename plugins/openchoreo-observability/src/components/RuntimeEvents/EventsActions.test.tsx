import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventsActions } from './EventsActions';
import { RuntimeEventsFilters, SELECTED_FIELDS } from './types';

// ---- Helpers ----

const baseFilters: RuntimeEventsFilters = {
  selectedFields: [...SELECTED_FIELDS],
  environment: 'env-1',
  timeRange: '1h',
  sortOrder: 'desc',
  isLive: false,
};

function renderActions(
  overrides: Partial<React.ComponentProps<typeof EventsActions>> = {},
) {
  const defaultProps = {
    totalCount: 7,
    disabled: false,
    onRefresh: jest.fn(),
    filters: baseFilters,
    onFiltersChange: jest.fn(),
    lastUpdated: new Date('2024-06-01T10:00:00Z'),
  };

  return {
    ...render(<EventsActions {...defaultProps} {...overrides} />),
    props: { ...defaultProps, ...overrides },
  };
}

// ---- Tests ----

describe('EventsActions', () => {
  it('displays the total event count', () => {
    renderActions();
    expect(screen.getByText('Total events: 7')).toBeInTheDocument();
  });

  it('displays the last updated time', () => {
    renderActions();
    expect(screen.getByText(/Last updated at:/)).toBeInTheDocument();
  });

  it('falls back to the current time when lastUpdated is absent', () => {
    renderActions({ lastUpdated: undefined });
    expect(screen.getByText(/Last updated at:/)).toBeInTheDocument();
  });

  it('shows "Newest First" when sort order is desc', () => {
    renderActions();
    expect(
      screen.getByRole('button', { name: /newest first/i }),
    ).toBeInTheDocument();
  });

  it('shows "Oldest First" when sort order is asc', () => {
    renderActions({ filters: { ...baseFilters, sortOrder: 'asc' } });
    expect(
      screen.getByRole('button', { name: /oldest first/i }),
    ).toBeInTheDocument();
  });

  it('toggles the sort order from desc to asc', async () => {
    const user = userEvent.setup();
    const onFiltersChange = jest.fn();
    renderActions({ onFiltersChange });

    await user.click(screen.getByRole('button', { name: /newest first/i }));

    expect(onFiltersChange).toHaveBeenCalledWith({ sortOrder: 'asc' });
  });

  it('toggles live mode on click', async () => {
    const user = userEvent.setup();
    const onFiltersChange = jest.fn();
    renderActions({ onFiltersChange });

    await user.click(screen.getByRole('button', { name: /live/i }));

    expect(onFiltersChange).toHaveBeenCalledWith({ isLive: true });
  });

  it('calls onRefresh when Refresh is clicked', async () => {
    const user = userEvent.setup();
    const onRefresh = jest.fn();
    renderActions({ onRefresh });

    await user.click(screen.getByRole('button', { name: /refresh/i }));

    expect(onRefresh).toHaveBeenCalled();
  });

  it('disables all buttons when disabled', () => {
    renderActions({ disabled: true });

    expect(
      screen.getByRole('button', { name: /newest first/i }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: /live/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /refresh/i })).toBeDisabled();
  });
});
