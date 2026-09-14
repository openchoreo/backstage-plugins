import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlatformLogsFilterRow } from './PlatformLogsFilterRow';
import { usePlatformLogFilterValues } from '../../hooks/usePlatformLogFilterValues';

// Mocked rather than served through a query client: these tests are about the row, and
// the hook has its own. It also keeps the row's own fetching out of the label and level
// assertions, none of which open a picker.
jest.mock('../../hooks/usePlatformLogFilterValues');

const mockFilterValues = usePlatformLogFilterValues as jest.MockedFunction<
  typeof usePlatformLogFilterValues
>;
import {
  DEFAULT_PLATFORM_LOG_FIELDS,
  PLATFORM_LOG_LEVELS,
  PlatformLogsFilters,
} from './types';

const EMPTY_FALLBACK = {
  clusterInstances: [],
  namespaces: [],
  podNames: [],
  containerNames: [],
};

/** The observer answering nothing, which is what most of these tests want. */
const noValues = { values: null, loading: false, error: null };

beforeEach(() => {
  jest.clearAllMocks();
  mockFilterValues.mockReturnValue(noValues);
});

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

const renderRow = (
  filters: PlatformLogsFilters = base(),
  over: Partial<Parameters<typeof PlatformLogsFilterRow>[0]> = {},
) => {
  const onFiltersChange = jest.fn();
  render(
    <PlatformLogsFilterRow
      open
      filters={filters}
      onFiltersChange={onFiltersChange}
      fallbackFacets={EMPTY_FALLBACK}
      observerUrl="http://observer.example"
      {...over}
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

describe('PlatformLogsFilterRow filter values', () => {
  it('asks for nothing until a picker is opened', () => {
    renderRow();

    expect(mockFilterValues).toHaveBeenCalledWith(
      'http://observer.example',
      null,
      expect.anything(),
      '',
    );
  });

  it('asks for the picker that was opened', async () => {
    renderRow();

    await userEvent.click(screen.getByLabelText('Pods'));

    expect(mockFilterValues).toHaveBeenLastCalledWith(
      'http://observer.example',
      'podName',
      expect.anything(),
      '',
    );
  });

  it('offers what the observer answered, with counts', async () => {
    mockFilterValues.mockReturnValue({
      values: [
        { value: 'controller-manager-abc', count: 412 },
        { value: 'gateway-xyz', count: 88 },
      ],
      loading: false,
      error: null,
    });
    renderRow();

    await userEvent.click(screen.getByLabelText('Pods'));

    expect(
      screen.getByRole('option', { name: /controller-manager-abc/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('412')).toBeInTheDocument();
  });

  // An observer that cannot answer must leave the page exactly as it was before the
  // endpoint existed, which is the state every deployment is in until it ships.
  it('falls back to the derived values when the observer cannot answer', async () => {
    renderRow(base(), {
      fallbackFacets: { ...EMPTY_FALLBACK, podNames: ['derived-pod'] },
    });

    await userEvent.click(screen.getByLabelText('Pods'));

    expect(
      screen.getByRole('option', { name: /derived-pod/ }),
    ).toBeInTheDocument();
  });

  // Capped out of the answer, or logged outside the window - either way the picker
  // draws no row for it, and an applied value with no row can never be unticked.
  it('offers an applied value the observer left out', async () => {
    mockFilterValues.mockReturnValue({
      values: [{ value: 'controller-manager-abc', count: 412 }],
      loading: false,
      error: null,
    });
    renderRow(base({ podNames: ['pod-from-a-shared-link'] }));

    await userEvent.click(screen.getByLabelText('Pods'));

    const options = screen.getAllByRole('option').map(o => o.textContent);
    expect(options[0]).toContain('pod-from-a-shared-link');
  });

  it('reports typing so the observer can narrow the values', async () => {
    renderRow();

    await userEvent.click(screen.getByLabelText('Pods'));
    await userEvent.type(screen.getByLabelText('Pods'), 'contro');

    await waitFor(() =>
      expect(mockFilterValues).toHaveBeenLastCalledWith(
        'http://observer.example',
        'podName',
        expect.anything(),
        'contro',
      ),
    );
  });
});
