import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogsActions } from './LogsActions';
import { LogEntryField, RuntimeLogsFilters } from './types';

// ---- Helpers ----

const baseFilters: RuntimeLogsFilters = {
  logLevel: [],
  selectedFields: [
    LogEntryField.Timestamp,
    LogEntryField.LogLevel,
    LogEntryField.Log,
  ],
  environmentId: 'env-1',
  timeRange: '1h',
  sortOrder: 'desc',
  isLive: false,
};

function renderActions(
  overrides: Partial<React.ComponentProps<typeof LogsActions>> = {},
) {
  const defaultProps = {
    totalCount: 42,
    disabled: false,
    onRefresh: jest.fn(),
    filters: baseFilters,
    onFiltersChange: jest.fn(),
    lastUpdated: new Date('2024-06-01T10:00:00Z'),
  };

  return {
    ...render(<LogsActions {...defaultProps} {...overrides} />),
    props: { ...defaultProps, ...overrides },
  };
}

// ---- Tests ----

describe('LogsActions', () => {
  it('displays total log count', () => {
    renderActions();

    expect(screen.getByText('Total logs: 42')).toBeInTheDocument();
  });

  it('displays last updated time', () => {
    renderActions();

    expect(
      screen.getByText(/Last updated at:/),
    ).toBeInTheDocument();
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

    await user.click(
      screen.getByRole('button', { name: /newest first/i }),
    );

    expect(onFiltersChange).toHaveBeenCalledWith({ sortOrder: 'asc' });
  });

  it('shows Live button', () => {
    renderActions();

    expect(
      screen.getByRole('button', { name: /live/i }),
    ).toBeInTheDocument();
  });

  it('toggles live mode on click', async () => {
    const user = userEvent.setup();
    const onFiltersChange = jest.fn();
    renderActions({ onFiltersChange });

    await user.click(screen.getByRole('button', { name: /live/i }));

    expect(onFiltersChange).toHaveBeenCalledWith({ isLive: true });
  });

  it('shows Refresh button', () => {
    renderActions();

    expect(
      screen.getByRole('button', { name: /refresh/i }),
    ).toBeInTheDocument();
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
    expect(
      screen.getByRole('button', { name: /live/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /refresh/i }),
    ).toBeDisabled();
  });
});
