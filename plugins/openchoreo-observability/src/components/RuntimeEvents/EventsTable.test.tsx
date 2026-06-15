import { render, screen } from '@testing-library/react';
import { EventsTable } from './EventsTable';
import { EventEntryField, EventEntry as EventEntryType } from './types';

// @tanstack/react-virtual needs real DOM layout (absent in jsdom) to decide
// what to render, so mock useVirtualizer with a stand-in that returns every
// item. Real windowing is the library's concern and is covered by the
// VirtualizedLogList tests in the react plugin.
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (args: any) => {
    const items = Array.from({ length: args.count }).map((_, index) => ({
      index,
      key: args.getItemKey ? args.getItemKey(index) : index,
      start: 0,
      size: 28,
    }));
    return {
      getVirtualItems: () => items,
      getTotalSize: () => args.count * 28,
      measureElement: () => {},
      scrollToIndex: () => {},
    };
  },
}));

// ---- Helpers ----

const allFields = [
  EventEntryField.Timestamp,
  EventEntryField.Type,
  EventEntryField.Reason,
  EventEntryField.Object,
  EventEntryField.Message,
];

const sampleEvents: EventEntryType[] = [
  {
    timestamp: '2024-06-01T10:00:00.000Z',
    message: 'Scaled up replica set',
    type: 'Normal',
    reason: 'ScalingReplicaSet',
    metadata: { objectKind: 'Deployment', objectName: 'api-service' },
  },
  {
    timestamp: '2024-06-01T10:01:00.000Z',
    message: 'Back-off restarting failed container',
    type: 'Warning',
    reason: 'BackOff',
    metadata: { objectKind: 'Pod', objectName: 'api-service-abc' },
  },
];

function renderTable(
  overrides: Partial<React.ComponentProps<typeof EventsTable>> = {},
) {
  const defaultProps = {
    selectedFields: allFields,
    events: sampleEvents,
    loading: false,
    hasMore: false,
    onLoadMore: jest.fn(),
    environmentName: 'development',
    projectName: 'my-project',
    componentName: 'api-service',
  };

  return render(<EventsTable {...defaultProps} {...overrides} />);
}

// ---- Tests ----

describe('EventsTable', () => {
  it('renders column headers based on selected fields', () => {
    renderTable();

    expect(screen.getByText('Timestamp')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Reason')).toBeInTheDocument();
    expect(screen.getByText('Object')).toBeInTheDocument();
    expect(screen.getByText('Message')).toBeInTheDocument();
  });

  it('renders event rows', () => {
    renderTable();

    expect(screen.getByText('Scaled up replica set')).toBeInTheDocument();
    expect(
      screen.getByText('Back-off restarting failed container'),
    ).toBeInTheDocument();
  });

  it('shows the empty state when there are no events and not loading', () => {
    renderTable({ events: [] });

    expect(screen.getByText('No events found')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Try adjusting your filters or time range to see more events.',
      ),
    ).toBeInTheDocument();
  });

  it('does not show the empty state while loading', () => {
    renderTable({ events: [], loading: true });

    expect(screen.queryByText('No events found')).not.toBeInTheDocument();
  });

  it('shows "Loading more events..." when hasMore and loading', () => {
    renderTable({ hasMore: true, loading: true });

    expect(screen.getByText('Loading more events...')).toBeInTheDocument();
  });

  it('shows "Scroll to load more events" when hasMore and not loading', () => {
    renderTable({ hasMore: true, loading: false });

    expect(screen.getByText('Scroll to load more events')).toBeInTheDocument();
  });

  it('does not show the pagination indicator when hasMore is false', () => {
    renderTable({ hasMore: false });

    expect(
      screen.queryByText('Loading more events...'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Scroll to load more events'),
    ).not.toBeInTheDocument();
  });

  it('renders only the selected field columns', () => {
    renderTable({ selectedFields: [EventEntryField.Message] });

    expect(screen.getByText('Message')).toBeInTheDocument();
    expect(screen.queryByText('Timestamp')).not.toBeInTheDocument();
    expect(screen.queryByText('Reason')).not.toBeInTheDocument();
  });
});
