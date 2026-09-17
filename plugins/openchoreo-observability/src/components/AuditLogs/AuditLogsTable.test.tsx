import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuditLogsTable } from './AuditLogsTable';
import { AUDIT_DEFAULT_COLUMNS, AuditLogRecord } from './types';

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
      size: 46,
    }));
    return {
      getVirtualItems: () => items,
      getTotalSize: () => args.count * 46,
      measureElement: () => {},
      scrollToIndex: () => {},
    };
  },
}));

const record = (over: Partial<AuditLogRecord> = {}): AuditLogRecord => ({
  schema_version: '1.0',
  event_id: 'e-1',
  event_time: '2026-09-03T10:00:00.000Z',
  actor: { type: 'user', id: 'dilani@openchoreo.dev' },
  action: 'create_project',
  category: 'management',
  result: 'success',
  producer: 'openchoreo-api',
  surface: 'rest',
  operation_id: 'CreateProject',
  resource: { type: 'project', namespace: 'default', name: 'checkout' },
  ...over,
});

describe('AuditLogsTable', () => {
  const defaults = {
    columns: AUDIT_DEFAULT_COLUMNS,
    loading: false,
    hasMore: false,
    onLoadMore: jest.fn(),
    onSelect: jest.fn(),
  };

  it('renders a row per record with the actor, action and resource', () => {
    render(
      <AuditLogsTable
        {...defaults}
        records={[
          record(),
          record({
            event_id: 'e-2',
            action: 'delete_component',
            result: 'denied',
            actor: { type: 'service_account', id: 'sa-ci-pipeline' },
            resource: { type: 'component', name: 'snip-api-service' },
          }),
        ]}
      />,
    );

    expect(screen.getByText('create_project')).toBeInTheDocument();
    expect(screen.getByText('dilani@openchoreo.dev')).toBeInTheDocument();
    expect(screen.getByText('checkout')).toBeInTheDocument();
    expect(screen.getByText('delete_component')).toBeInTheDocument();
    expect(screen.getByText('denied')).toBeInTheDocument();
  });

  it('says why a rejected record has no action rather than leaving it blank', () => {
    render(
      <AuditLogsTable
        {...defaults}
        records={[
          record({
            action: '',
            category: '',
            result: 'failure',
            resource: null,
          }),
        ]}
      />,
    );

    expect(screen.getByText('no action resolved')).toBeInTheDocument();
  });

  it('only renders the selected columns', () => {
    render(
      <AuditLogsTable
        {...defaults}
        columns={['time', 'actor', 'action', 'resource', 'result']}
        records={[record()]}
      />,
    );

    expect(screen.queryByText('Producer')).not.toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
  });

  it('selects a record when its row is clicked', async () => {
    const onSelect = jest.fn();
    render(
      <AuditLogsTable {...defaults} onSelect={onSelect} records={[record()]} />,
    );

    await userEvent.click(screen.getByText('create_project'));

    expect(onSelect).toHaveBeenCalledWith('e-1');
  });

  it('offers to clear filters when a query matched nothing', async () => {
    const onClearFilters = jest.fn();
    render(
      <AuditLogsTable
        {...defaults}
        records={[]}
        hasFilters
        onClearFilters={onClearFilters}
      />,
    );

    expect(screen.getByText('No records match this query')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Clear all filters' }),
    );
    expect(onClearFilters).toHaveBeenCalled();
  });

  it('does not offer to clear filters when there are none to clear', () => {
    render(<AuditLogsTable {...defaults} records={[]} />);

    expect(
      screen.queryByRole('button', { name: 'Clear all filters' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Nothing was recorded in this window/),
    ).toBeInTheDocument();
  });

  it('shows skeleton rows on the first load', () => {
    render(<AuditLogsTable {...defaults} records={[]} loading />);

    expect(screen.getAllByTestId('audit-row-skeleton').length).toBeGreaterThan(
      0,
    );
  });
});
