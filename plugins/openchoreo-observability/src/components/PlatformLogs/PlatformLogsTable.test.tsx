import { render, screen } from '@testing-library/react';
import { PlatformLogsTable } from './PlatformLogsTable';
import {
  DEFAULT_PLATFORM_LOG_FIELDS,
  PlatformLogEntry,
  PlatformLogField,
} from './types';

// @tanstack/react-virtual needs real DOM layout (absent in jsdom) to decide what to
// render, so mock useVirtualizer with a stand-in that returns every item. Real
// windowing is the library's concern and is covered by VirtualizedLogList's own tests.
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

const sampleLogs: PlatformLogEntry[] = [
  {
    timestamp: '2026-08-14T16:31:00.000Z',
    log: 'reconcile failed',
    level: 'ERROR',
    clusterInstance: 'cluster1',
    namespaceName: 'openchoreo-control-plane',
    podName: 'controller-manager-7f58b689b5-pwsb5',
    containerName: 'manager',
  },
];

const renderTable = (
  props: Partial<Parameters<typeof PlatformLogsTable>[0]> = {},
) =>
  render(
    <PlatformLogsTable
      selectedFields={DEFAULT_PLATFORM_LOG_FIELDS}
      logs={sampleLogs}
      loading={false}
      hasMore={false}
      onLoadMore={jest.fn()}
      {...props}
    />,
  );

describe('PlatformLogsTable', () => {
  it('renders the selected columns as headers', () => {
    renderTable();

    for (const field of DEFAULT_PLATFORM_LOG_FIELDS) {
      expect(
        screen.getByRole('columnheader', { name: field }),
      ).toBeInTheDocument();
    }
  });

  it('renders the physical coordinates of each record', () => {
    renderTable();

    expect(screen.getByText('reconcile failed')).toBeInTheDocument();
    expect(screen.getByText('ERROR')).toBeInTheDocument();
    expect(screen.getByText('openchoreo-control-plane')).toBeInTheDocument();
    expect(
      screen.getByText('controller-manager-7f58b689b5-pwsb5'),
    ).toBeInTheDocument();
  });

  it('only renders the columns that are selected', () => {
    renderTable({
      selectedFields: [PlatformLogField.Timestamp, PlatformLogField.Log],
    });

    expect(
      screen.queryByText('openchoreo-control-plane'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('reconcile failed')).toBeInTheDocument();
  });

  it('shows the cluster column when asked for it', () => {
    renderTable({
      selectedFields: [PlatformLogField.Cluster, PlatformLogField.Log],
    });

    expect(screen.getByText('cluster1')).toBeInTheDocument();
  });

  // The empty state has to point at the label filter: the page ships with a
  // control-plane selector applied, so "no logs" most often means "you are looking at
  // the wrong slice", not "there is nothing here".
  it('tells the user how to widen an empty result', () => {
    renderTable({ logs: [] });

    expect(screen.getByText('No logs found')).toBeInTheDocument();
    expect(
      screen.getByText(/clearing the label selector/i),
    ).toBeInTheDocument();
  });

  it('shows skeletons instead of the empty state while loading', () => {
    renderTable({ logs: [], loading: true });

    expect(screen.queryByText('No logs found')).not.toBeInTheDocument();
  });
});
