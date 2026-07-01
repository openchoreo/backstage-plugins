import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LogsTable } from './LogsTable';
import { LogEntryField } from './types';
import { LogEntry as LogEntryType } from './types';

// @tanstack/react-virtual needs real DOM layout (absent in jsdom) to decide
// what to render, so mock useVirtualizer with a stand-in that returns every
// item. The footer slot in VirtualizedLogList renders outside the
// virtualizer, so it appears naturally in the rendered tree. Real windowing
// is the library's concern and is covered by the VirtualizedLogList tests in
// the react plugin.
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
  LogEntryField.Timestamp,
  LogEntryField.LogLevel,
  LogEntryField.Log,
];

const sampleLogs: LogEntryType[] = [
  {
    timestamp: '2024-06-01T10:00:00.000Z',
    log: 'First log message',
    level: 'INFO',
    metadata: {
      componentName: 'svc-a',
      componentUid: '',
      projectName: 'proj',
      projectUid: '',
      environmentName: 'dev',
      environmentUid: '',
      podName: 'pod-1',
      podNamespace: 'ns',
      namespaceName: 'ns',
      containerName: 'main',
    },
  },
  {
    timestamp: '2024-06-01T10:01:00.000Z',
    log: 'Second log message',
    level: 'ERROR',
    metadata: {
      componentName: 'svc-b',
      componentUid: '',
      projectName: 'proj',
      projectUid: '',
      environmentName: 'dev',
      environmentUid: '',
      podName: 'pod-2',
      podNamespace: 'ns',
      namespaceName: 'ns',
      containerName: 'main',
    },
  },
];

function renderTable(
  overrides: Partial<React.ComponentProps<typeof LogsTable>> = {},
) {
  const defaultProps = {
    selectedFields: allFields,
    logs: sampleLogs,
    loading: false,
    hasMore: false,
    onLoadMore: jest.fn(),
    environmentName: 'development',
    projectName: 'my-project',
  };

  return render(
    <MemoryRouter>
      <LogsTable {...defaultProps} {...overrides} />
    </MemoryRouter>,
  );
}

// ---- Tests ----

describe('LogsTable', () => {
  it('renders column headers based on selected fields', () => {
    renderTable();

    expect(screen.getByText('Timestamp')).toBeInTheDocument();
    expect(screen.getByText('LogLevel')).toBeInTheDocument();
    expect(screen.getByText('Log')).toBeInTheDocument();
  });

  it('renders ComponentName header when field is selected', () => {
    renderTable({
      selectedFields: [...allFields, LogEntryField.ComponentName],
    });

    expect(screen.getByText('Component Name')).toBeInTheDocument();
  });

  it('renders log entries', () => {
    renderTable();

    expect(screen.getByText('First log message')).toBeInTheDocument();
    expect(screen.getByText('Second log message')).toBeInTheDocument();
  });

  it('shows empty state when no logs and not loading', () => {
    renderTable({ logs: [] });

    expect(screen.getByText('No logs found')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Try adjusting your filters or time range to see more logs.',
      ),
    ).toBeInTheDocument();
  });

  it('shows loading skeletons when loading with no logs', () => {
    renderTable({ logs: [], loading: true });

    // Should not show empty state
    expect(screen.queryByText('No logs found')).not.toBeInTheDocument();
  });

  it('does not show empty state when loading', () => {
    renderTable({ logs: [], loading: true });

    expect(screen.queryByText('No logs found')).not.toBeInTheDocument();
  });

  it('shows "Loading more logs..." when hasMore and loading', () => {
    renderTable({ hasMore: true, loading: true });

    expect(screen.getByText('Loading more logs...')).toBeInTheDocument();
  });

  it('shows "Scroll to load more" when hasMore and not loading', () => {
    renderTable({ hasMore: true, loading: false });

    expect(screen.getByText('Scroll to load more logs')).toBeInTheDocument();
  });

  it('does not show pagination indicator when hasMore is false', () => {
    renderTable({ hasMore: false });

    expect(screen.queryByText('Loading more logs...')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Scroll to load more logs'),
    ).not.toBeInTheDocument();
  });

  it('renders only selected field columns', () => {
    renderTable({ selectedFields: [LogEntryField.Log] });

    expect(screen.getByText('Log')).toBeInTheDocument();
    expect(screen.queryByText('Timestamp')).not.toBeInTheDocument();
    expect(screen.queryByText('LogLevel')).not.toBeInTheDocument();
  });
});
