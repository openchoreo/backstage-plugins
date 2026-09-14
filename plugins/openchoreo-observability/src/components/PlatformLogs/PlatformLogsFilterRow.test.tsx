import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlatformLogsFilterRow } from './PlatformLogsFilterRow';
import {
  DEFAULT_PLATFORM_LOG_FIELDS,
  PLATFORM_LOG_LEVELS,
  PlatformLogsFilters,
} from './types';

const EMPTY_FACETS = {
  clusterInstances: [],
  namespaces: [],
  podNames: [],
  containerNames: [],
};

const base = (
  over: Partial<PlatformLogsFilters> = {},
): PlatformLogsFilters => ({
  observabilityPlane: 'default',
  selectedFields: DEFAULT_PLATFORM_LOG_FIELDS,
  clusterInstances: [],
  namespaces: [],
  podNames: [],
  containerNames: [],
  labels: '',
  logLevel: [...PLATFORM_LOG_LEVELS],
  timeRange: '10m',
  sortOrder: 'desc',
  ...over,
});

const renderRow = (filters: PlatformLogsFilters = base()) => {
  const onFiltersChange = jest.fn();
  render(
    <PlatformLogsFilterRow
      open
      filters={filters}
      onFiltersChange={onFiltersChange}
      facets={EMPTY_FACETS}
    />,
  );
  return { onFiltersChange };
};

describe('PlatformLogsFilterRow label validation', () => {
  const labelsField = () => screen.getByLabelText('Labels');

  it('explains why the field is unhappy, in place of the hint', async () => {
    renderRow();

    await userEvent.type(labelsField(), 'openchoreo.dev/plane');

    expect(screen.getByText(/not a key=value pair/)).toBeInTheDocument();
    expect(screen.queryByText(/Comma means AND/)).not.toBeInTheDocument();
  });

  // The behaviour this change exists for: a half-typed selector used to reach the
  // observer after the debounce and come back as a 400.
  it('does not apply a selector that cannot parse', async () => {
    jest.useFakeTimers();
    try {
      const { onFiltersChange } = renderRow();

      await userEvent.type(labelsField(), 'openchoreo.dev/plane', {
        advanceTimers: jest.advanceTimersByTime,
      });
      jest.advanceTimersByTime(5000);

      expect(onFiltersChange).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('applies it once it parses', async () => {
    jest.useFakeTimers();
    try {
      const { onFiltersChange } = renderRow();

      await userEvent.type(labelsField(), 'tier=infra', {
        advanceTimers: jest.advanceTimersByTime,
      });
      jest.advanceTimersByTime(5000);

      expect(onFiltersChange).toHaveBeenCalledWith({ labels: 'tier=infra' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows the hint and no error when the field is valid', async () => {
    renderRow(base({ labels: 'tier=infra' }));

    await waitFor(() =>
      expect(screen.getByText(/Comma means AND/)).toBeInTheDocument(),
    );
  });
});
