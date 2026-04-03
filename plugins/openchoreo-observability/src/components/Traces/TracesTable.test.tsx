import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TracesTable } from './TracesTable';
import { Trace } from '../../types';

// ---- Helpers ----

const sampleTrace: Trace = {
  traceId: 'abc12345def67890',
  traceName: 'GET /api/users',
  startTime: '2024-06-01T10:00:00.000Z',
  endTime: '2024-06-01T10:00:01.500Z',
  durationNs: 1500000000,
  spanCount: 5,
};

const mockTraceSpans = {
  fetchSpans: jest.fn(),
  getSpans: jest.fn().mockReturnValue(undefined),
  isLoading: jest.fn().mockReturnValue(false),
  getError: jest.fn().mockReturnValue(undefined),
};

const mockSpanDetails = {
  fetchSpanDetails: jest.fn(),
  getDetails: jest.fn().mockReturnValue(undefined),
  isLoading: jest.fn().mockReturnValue(false),
  getError: jest.fn().mockReturnValue(undefined),
};

function renderTable(
  overrides: {
    traces?: Trace[];
    loading?: boolean;
  } = {},
) {
  const defaultProps = {
    traces: [sampleTrace],
    traceSpans: mockTraceSpans,
    spanDetails: mockSpanDetails,
    loading: false,
    ...overrides,
  };

  return render(<TracesTable {...defaultProps} />);
}

// ---- Tests ----

describe('TracesTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders table headers', () => {
    renderTable();

    expect(screen.getByText('Trace Name')).toBeInTheDocument();
    expect(screen.getByText('Start Time')).toBeInTheDocument();
    expect(screen.getByText('End Time')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Number of Spans')).toBeInTheDocument();
    expect(screen.getByText('Details')).toBeInTheDocument();
  });

  it('renders trace data', () => {
    renderTable();

    expect(screen.getByText('GET /api/users')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows empty state when no traces', () => {
    renderTable({ traces: [] });

    expect(screen.getByText('No traces found')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Try adjusting your filters or time range to see more traces.',
      ),
    ).toBeInTheDocument();
  });

  it('does not show empty state when loading', () => {
    renderTable({ traces: [], loading: true });

    expect(screen.queryByText('No traces found')).not.toBeInTheDocument();
  });

  it('truncates long trace IDs when no trace name', () => {
    renderTable({
      traces: [
        {
          ...sampleTrace,
          traceName: undefined,
        },
      ],
    });

    expect(screen.getByText('abc12345...')).toBeInTheDocument();
  });

  it('calls fetchSpans on row expansion', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByText('GET /api/users'));

    expect(mockTraceSpans.fetchSpans).toHaveBeenCalledWith(
      'abc12345def67890',
    );
  });

  it('shows span error when expanded with error', async () => {
    const user = userEvent.setup();
    mockTraceSpans.getError.mockReturnValue('Network error');
    renderTable();

    await user.click(screen.getByText('GET /api/users'));

    expect(
      screen.getByText('Failed to load spans: Network error'),
    ).toBeInTheDocument();
  });
});
