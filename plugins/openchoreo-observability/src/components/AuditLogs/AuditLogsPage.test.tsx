import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderInTestApp } from '@backstage/test-utils';
import { AuditLogsPage } from './AuditLogsPage';
import {
  AuditLogsForbiddenError,
  AuditLogsNotEnabledError,
  AuditLogsNotSupportedError,
} from '../../api/AuditLogsErrors';
import { AuditLogRecord } from './types';

const mockUseAuditLogsPermission = jest.fn();

// The page pulls TimeRangeFilter and the permission hook from this package,
// while its own modules read TIME_RANGE_OPTIONS and calculateTimeRange from it
// — so the real implementations of those two are kept.
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  TIME_RANGE_OPTIONS: jest.requireActual('@openchoreo/backstage-plugin-react')
    .TIME_RANGE_OPTIONS,
  calculateTimeRange: jest.requireActual('@openchoreo/backstage-plugin-react')
    .calculateTimeRange,
  useAuditLogsPermission: () => mockUseAuditLogsPermission(),
  ForbiddenState: ({ title, message }: any) => (
    <div data-testid="forbidden-state">
      {title}
      {message}
    </div>
  ),
  TimeRangeFilter: ({ value }: any) => (
    <div data-testid="time-range">{value}</div>
  ),
}));

jest.mock('@openchoreo/backstage-design-system', () => ({
  PageLoader: () => <div data-testid="page-loader" />,
  RefreshOverlay: ({ active }: any) => (
    <div data-testid="refresh-overlay">{String(active)}</div>
  ),
  Skeleton: () => <div data-testid="skeleton" />,
}));

const mockUseAuditLogs = jest.fn();
const mockUseAuditQuerySummary = jest.fn();
const mockUseAuditEvent = jest.fn();

jest.mock('../../hooks/useAuditLogs', () => ({
  useAuditLogs: (...args: any[]) => mockUseAuditLogs(...args),
  AUDIT_PAGE_SIZE: 100,
}));

jest.mock('../../hooks/useAuditQuerySummary', () => ({
  useAuditQuerySummary: (...args: any[]) => mockUseAuditQuerySummary(...args),
}));

jest.mock('../../hooks/useAuditEvent', () => ({
  useAuditEvent: (...args: any[]) => mockUseAuditEvent(...args),
}));

jest.mock('./AuditQueryBar', () => ({
  AuditQueryBar: ({ tokens }: any) => (
    <div data-testid="query-bar">{tokens.length} filters</div>
  ),
}));

jest.mock('./AuditLogsTable', () => ({
  AuditLogsTable: ({ records, loading }: any) => (
    <div data-testid="audit-table">
      <span data-testid="record-count">{records.length}</span>
      <span data-testid="table-loading">{String(loading)}</span>
    </div>
  ),
}));

jest.mock('./AuditEventDrawer', () => ({
  __esModule: true,
  default: ({ open, record }: any) => (
    <div data-testid="audit-drawer">
      {String(open)}
      <span data-testid="drawer-record">{record?.event_id ?? 'none'}</span>
    </div>
  ),
}));

jest.mock('./AuditColumnsPicker', () => ({
  AuditColumnsPicker: ({ columns }: any) => (
    <div data-testid="columns-picker">{columns.length}</div>
  ),
}));

const record: AuditLogRecord = {
  schema_version: '1.0',
  event_id: 'e-1',
  event_time: '2026-09-03T10:00:00.000Z',
  actor: { type: 'user', id: 'dilani@openchoreo.dev' },
  action: 'create_project',
  category: 'management',
  result: 'success',
};

const recordsResult = (over: Record<string, unknown> = {}) => ({
  records: [record],
  loading: false,
  loadingMore: false,
  isRefetching: false,
  error: null,
  hasMore: false,
  loadMore: jest.fn(),
  refresh: jest.fn(),
  ...over,
});

const summaryResult = (over: Record<string, unknown> = {}) => ({
  total: 1,
  loading: false,
  isRefetching: false,
  error: null,
  refetch: jest.fn(),
  ...over,
});

describe('AuditLogsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuditLogsPermission.mockReturnValue({
      canViewAuditLogs: true,
      loading: false,
      deniedTooltip: '',
      permissionName: 'openchoreo.auditlogs.view',
    });
    mockUseAuditLogs.mockReturnValue(recordsResult());
    mockUseAuditQuerySummary.mockReturnValue(summaryResult());
    mockUseAuditEvent.mockReturnValue({
      record: undefined,
      loading: false,
      error: null,
    });
  });

  it('renders the trail when the user may read it', async () => {
    await renderInTestApp(<AuditLogsPage />);

    expect(screen.getByTestId('record-count')).toHaveTextContent('1');
    expect(screen.getByTestId('query-bar')).toBeInTheDocument();
  });

  it('shows the forbidden state instead of an empty table when denied', async () => {
    mockUseAuditLogsPermission.mockReturnValue({
      canViewAuditLogs: false,
      loading: false,
      deniedTooltip: 'nope',
      permissionName: 'openchoreo.auditlogs.view',
    });

    await renderInTestApp(<AuditLogsPage />);

    expect(screen.getByTestId('forbidden-state')).toHaveTextContent(
      'You do not have permission to view audit logs.',
    );
    expect(screen.queryByTestId('audit-table')).not.toBeInTheDocument();
  });

  it('shows the forbidden state when the observer itself refuses the read', async () => {
    mockUseAuditLogs.mockReturnValue(
      recordsResult({
        records: [],
        error: new AuditLogsForbiddenError(),
      }),
    );

    await renderInTestApp(<AuditLogsPage />);

    expect(screen.getByTestId('forbidden-state')).toBeInTheDocument();
  });

  it('says the deployment does not serve the trail on a 501', async () => {
    mockUseAuditLogs.mockReturnValue(
      recordsResult({
        records: [],
        error: new AuditLogsNotSupportedError(),
      }),
    );

    await renderInTestApp(<AuditLogsPage />);

    expect(
      screen.getByText(/cannot be queried for audit records/),
    ).toBeInTheDocument();
    // An unsupported read must not look like "nothing happened".
    expect(screen.queryByTestId('audit-table')).not.toBeInTheDocument();
  });

  it('says audit logs are not enabled when the installation reports so', async () => {
    mockUseAuditLogs.mockReturnValue(
      recordsResult({
        records: [],
        error: new AuditLogsNotEnabledError(),
      }),
    );

    await renderInTestApp(<AuditLogsPage />);

    expect(screen.getByText('Audit Logs Disabled')).toBeInTheDocument();
    expect(screen.queryByTestId('audit-table')).not.toBeInTheDocument();
  });

  it('waits for the permission check before deciding what to show', async () => {
    mockUseAuditLogsPermission.mockReturnValue({
      canViewAuditLogs: false,
      loading: true,
      deniedTooltip: '',
      permissionName: 'openchoreo.auditlogs.view',
    });

    await renderInTestApp(<AuditLogsPage />);

    expect(screen.getByTestId('page-loader')).toBeInTheDocument();
    expect(screen.queryByTestId('forbidden-state')).not.toBeInTheDocument();
  });

  it('surfaces an ordinary query error above the table', async () => {
    mockUseAuditLogs.mockReturnValue(
      recordsResult({ records: [], error: new Error('opensearch is down') }),
    );

    await renderInTestApp(<AuditLogsPage />);

    await waitFor(() =>
      expect(screen.getByText('opensearch is down')).toBeInTheDocument(),
    );
    // The table stays, so a transient failure does not wipe the view.
    expect(screen.getByTestId('audit-table')).toBeInTheDocument();
  });

  it('does not gate the query on a permission check that has not resolved', async () => {
    await renderInTestApp(<AuditLogsPage />);

    expect(mockUseAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  });

  it('re-keys both queries on Refresh, so a custom window is not answered from cache', async () => {
    await renderInTestApp(<AuditLogsPage />);

    expect(mockUseAuditLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ generation: 0 }),
    );

    await userEvent.click(screen.getByRole('button', { name: /refresh/i }));

    // A custom range resolves to the same two timestamps every time, so the
    // generation is the only thing that moves the key.
    await waitFor(() =>
      expect(mockUseAuditLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ generation: 1 }),
      ),
    );
    expect(mockUseAuditQuerySummary).toHaveBeenLastCalledWith(
      expect.objectContaining({ generation: 1 }),
    );
  });

  describe('the open record', () => {
    it('keeps the drawer open when the record leaves the result set', async () => {
      const { rerender } = await renderInTestApp(<AuditLogsPage />, {
        routeEntries: ['/?event=e-1'],
      });

      await waitFor(() =>
        expect(screen.getByTestId('drawer-record')).toHaveTextContent('e-1'),
      );

      // Drilling on an attribute re-queries; the record need not come back on
      // the first page of the narrowed, oldest-first set.
      mockUseAuditLogs.mockReturnValue(recordsResult({ records: [] }));
      rerender(<AuditLogsPage />);

      await waitFor(() =>
        expect(screen.getByTestId('audit-drawer')).toHaveTextContent('true'),
      );
      expect(screen.getByTestId('drawer-record')).toHaveTextContent('e-1');
    });

    it('stays shut when nothing is selected', async () => {
      await renderInTestApp(<AuditLogsPage />);

      expect(screen.getByTestId('drawer-record')).toHaveTextContent('none');
      expect(screen.getByTestId('audit-drawer')).toHaveTextContent('false');
    });

    it('opens a linked record that is on none of the loaded pages', async () => {
      const deepLinked = { ...record, event_id: 'e-9' };
      mockUseAuditEvent.mockReturnValue({
        record: deepLinked,
        loading: false,
        error: null,
      });

      await renderInTestApp(<AuditLogsPage />, {
        routeEntries: ['/?event=e-9'],
      });

      await waitFor(() =>
        expect(screen.getByTestId('drawer-record')).toHaveTextContent('e-9'),
      );
    });

    it('looks a linked record up only while the loaded pages lack it', async () => {
      await renderInTestApp(<AuditLogsPage />, {
        routeEntries: ['/?event=e-1'],
      });

      // `e-1` is the loaded record, so a by-id read would ask again for what is
      // already on screen.
      expect(mockUseAuditEvent).toHaveBeenLastCalledWith(
        expect.objectContaining({ eventId: 'e-1', enabled: false }),
      );
    });
  });

  describe('last updated', () => {
    const shownTime = () =>
      screen.getByText(/Last updated at:/).textContent ?? '';

    beforeEach(() => {
      jest.useFakeTimers({
        doNotFake: ['queueMicrotask', 'setImmediate', 'nextTick'],
      });
      jest.setSystemTime(new Date('2026-09-03T10:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('holds still across a render that fetched nothing', async () => {
      await renderInTestApp(<AuditLogsPage />);
      const before = shownTime();

      jest.setSystemTime(new Date('2026-09-03T10:05:00.000Z'));
      // Refresh re-renders the page; the mocked query never reports a fetch,
      // so there is no new truth to stamp.
      await userEvent.click(screen.getByRole('button', { name: /refresh/i }), {
        advanceTimers: jest.advanceTimersByTime,
      });

      expect(shownTime()).toBe(before);
    });

    it('advances when a background refetch settles, which is how Live stamps it', async () => {
      mockUseAuditLogs.mockReturnValue(recordsResult({ isRefetching: true }));
      const { rerender } = await renderInTestApp(<AuditLogsPage />);
      const before = shownTime();

      jest.setSystemTime(new Date('2026-09-03T10:05:00.000Z'));
      mockUseAuditLogs.mockReturnValue(recordsResult({ isRefetching: false }));
      rerender(<AuditLogsPage />);

      await waitFor(() => expect(shownTime()).not.toBe(before));
    });
  });
});
