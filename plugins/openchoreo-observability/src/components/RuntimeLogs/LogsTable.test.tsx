import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { LogsTable } from './LogsTable';
import { LogEntryField } from './types';
import { LogEntry as LogEntryType } from './types';

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
  const loadingRef = createRef<HTMLDivElement>();
  const defaultProps = {
    selectedFields: allFields,
    logs: sampleLogs,
    loading: false,
    hasMore: false,
    loadingRef,
    environmentName: 'development',
    projectName: 'my-project',
  };

  return render(<LogsTable {...defaultProps} {...overrides} />);
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
