import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RunsActions } from './RunsActions';
import { RunsFilters, RUNS_PAGE_SIZE } from './types';

const baseFilters: RunsFilters = {
  environmentId: 'env-1',
  timeRange: '24h',
  sortOrder: 'desc',
  page: 0,
};

function renderActions(
  overrides: Partial<React.ComponentProps<typeof RunsActions>> = {},
) {
  const defaultProps = {
    totalCount: 100,
    disabled: false,
    onRefresh: jest.fn(),
    filters: baseFilters,
    onFiltersChange: jest.fn(),
    lastUpdated: new Date('2026-06-01T10:00:00Z'),
  };
  return {
    ...render(<RunsActions {...defaultProps} {...overrides} />),
    props: { ...defaultProps, ...overrides },
  };
}

describe('RunsActions', () => {
  describe('total count and showing-range display', () => {
    it('shows total and current window when there are results', () => {
      renderActions({ totalCount: 100, filters: { ...baseFilters, page: 0 } });
      expect(screen.getByText(/Total runs:\s*100/)).toBeInTheDocument();
      expect(screen.getByText(/showing 1-20/)).toBeInTheDocument();
    });

    it('shows only total when there are zero results, no showing range', () => {
      renderActions({ totalCount: 0 });
      expect(screen.getByText(/Total runs:\s*0/)).toBeInTheDocument();
      expect(screen.queryByText(/showing/)).not.toBeInTheDocument();
    });

    it('caps endItem at totalCount on the last (partial) page', () => {
      // With page size 20 and total 25, page 1 (0-indexed) should show 21-25.
      renderActions({
        totalCount: 25,
        filters: { ...baseFilters, page: 1 },
      });
      expect(screen.getByText(/showing 21-25/)).toBeInTheDocument();
    });
  });

  describe('page indicator', () => {
    it('displays 1 / N when on the first page', () => {
      // total 45 / 20 = 3 pages
      renderActions({ totalCount: 45 });
      expect(screen.getByText('Page 1 / 3')).toBeInTheDocument();
    });

    it('always shows at least 1 total page even when totalCount is 0', () => {
      renderActions({ totalCount: 0 });
      expect(screen.getByText('Page 1 / 1')).toBeInTheDocument();
    });
  });

  describe('Prev button', () => {
    it('is disabled on the first page', () => {
      renderActions({ filters: { ...baseFilters, page: 0 } });
      expect(screen.getByRole('button', { name: /Prev/i })).toBeDisabled();
    });

    it('is enabled on non-first pages', () => {
      renderActions({
        totalCount: 100,
        filters: { ...baseFilters, page: 1 },
      });
      expect(screen.getByRole('button', { name: /Prev/i })).toBeEnabled();
    });

    it('dispatches page-1 to onFiltersChange when clicked', async () => {
      const onFiltersChange = jest.fn();
      renderActions({
        totalCount: 100,
        filters: { ...baseFilters, page: 2 },
        onFiltersChange,
      });
      await userEvent.click(screen.getByRole('button', { name: /Prev/i }));
      expect(onFiltersChange).toHaveBeenCalledWith({ page: 1 });
    });
  });

  describe('Next button', () => {
    it('is enabled when more pages remain', () => {
      // 3 pages available, on page 0
      renderActions({ totalCount: 45, filters: { ...baseFilters, page: 0 } });
      expect(screen.getByRole('button', { name: /Next/i })).toBeEnabled();
    });

    it('is disabled on the last page', () => {
      // 3 pages, on page 2 (0-indexed) = last page
      renderActions({ totalCount: 45, filters: { ...baseFilters, page: 2 } });
      expect(screen.getByRole('button', { name: /Next/i })).toBeDisabled();
    });

    it('is disabled when totalCount is 0 (single-page indicator = only page)', () => {
      renderActions({ totalCount: 0 });
      expect(screen.getByRole('button', { name: /Next/i })).toBeDisabled();
    });

    it('dispatches page+1 to onFiltersChange when clicked', async () => {
      const onFiltersChange = jest.fn();
      renderActions({
        totalCount: 100,
        filters: { ...baseFilters, page: 1 },
        onFiltersChange,
      });
      await userEvent.click(screen.getByRole('button', { name: /Next/i }));
      expect(onFiltersChange).toHaveBeenCalledWith({ page: 2 });
    });
  });

  describe('Refresh button', () => {
    it('invokes onRefresh when clicked', async () => {
      const onRefresh = jest.fn();
      renderActions({ onRefresh });
      await userEvent.click(screen.getByRole('button', { name: /Refresh/i }));
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('disabled prop', () => {
    it('disables all three buttons regardless of pagination state', () => {
      // On a middle page (Prev + Next would normally be enabled) verify the top-level
      // `disabled` flag overrides both.
      renderActions({
        totalCount: 100,
        filters: { ...baseFilters, page: 1 },
        disabled: true,
      });
      expect(screen.getByRole('button', { name: /Prev/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Next/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Refresh/i })).toBeDisabled();
    });
  });

  describe('lastUpdated', () => {
    it('renders the provided lastUpdated timestamp', () => {
      renderActions({ lastUpdated: new Date('2026-06-01T10:00:00Z') });
      // formatDate uses local time zone; we just assert the "Last updated at:" prefix
      // and the year appear so the test is TZ-agnostic.
      expect(screen.getByText(/Last updated at:.*2026/)).toBeInTheDocument();
    });

    it('falls back to a rendered date when lastUpdated is undefined', () => {
      renderActions({ lastUpdated: undefined });
      // Match the DD/MM/YYYY, HH:MM:SS shape from formatDate.
      expect(
        screen.getByText(
          /Last updated at:\s*\d{2}\/\d{2}\/\d{4},\s*\d{2}:\d{2}:\d{2}/,
        ),
      ).toBeInTheDocument();
    });
  });

  describe('page size constant', () => {
    it('uses RUNS_PAGE_SIZE for the window (guard against silent constant changes)', () => {
      // If someone bumps RUNS_PAGE_SIZE, this test flags that the component was
      // wired to it and the assertion needs updating alongside.
      renderActions({ totalCount: RUNS_PAGE_SIZE * 2 });
      expect(screen.getByText('Page 1 / 2')).toBeInTheDocument();
      expect(
        screen.getByText(new RegExp(`showing 1-${RUNS_PAGE_SIZE}`)),
      ).toBeInTheDocument();
    });
  });
});
