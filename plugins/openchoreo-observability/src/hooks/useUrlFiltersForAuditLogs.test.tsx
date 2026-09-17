import { act, renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useUrlFiltersForAuditLogs } from './useUrlFiltersForAuditLogs';
import { AUDIT_DEFAULT_COLUMNS } from '../components/AuditLogs/types';

function renderWithUrl(initialUrl: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialUrl]}>{children}</MemoryRouter>
  );
  return renderHook(() => useUrlFiltersForAuditLogs(), { wrapper });
}

describe('useUrlFiltersForAuditLogs', () => {
  it('defaults to a week, oldest first, with the default columns', () => {
    const { result } = renderWithUrl('/audit-logs');

    expect(result.current.filters.timeRange).toBe('7d');
    // A trail is read forwards, so the default is the order the events
    // happened in.
    expect(result.current.filters.sortOrder).toBe('asc');
    expect(result.current.filters.tokens).toEqual([]);
    expect(result.current.filters.columns).toEqual(AUDIT_DEFAULT_COLUMNS);
  });

  it('reads newest-first back from the URL', () => {
    const { result } = renderWithUrl('/audit-logs?sort=desc');

    expect(result.current.filters.sortOrder).toBe('desc');
  });

  it('keeps the default order out of the URL', () => {
    const { result } = renderWithUrl('/audit-logs?sort=desc');

    act(() => result.current.updateFilters({ sortOrder: 'asc' }));

    expect(result.current.filters.sortOrder).toBe('asc');
  });

  it('reads repeated f params as filter tokens', () => {
    const { result } = renderWithUrl(
      '/audit-logs?f=result:denied&f=result:failure&f=actor.id:alice@example.com',
    );

    expect(result.current.filters.tokens).toEqual([
      { path: 'result', value: 'denied' },
      { path: 'result', value: 'failure' },
      { path: 'actor.id', value: 'alice@example.com' },
    ]);
  });

  it('keeps a value containing a colon intact', () => {
    const { result } = renderWithUrl(
      '/audit-logs?f=actor.issuer:https://thunder.example.com/oauth2/token',
    );

    expect(result.current.filters.tokens).toEqual([
      {
        path: 'actor.issuer',
        value: 'https://thunder.example.com/oauth2/token',
      },
    ]);
  });

  it('ignores a filter path the API does not accept', () => {
    const { result } = renderWithUrl(
      '/audit-logs?f=resource.uid:abc&f=result:denied',
    );

    expect(result.current.filters.tokens).toEqual([
      { path: 'result', value: 'denied' },
    ]);
  });

  it('ignores a closed filter carrying a value the API rejects', () => {
    const { result } = renderWithUrl(
      '/audit-logs?f=result:unknown&f=surface:grpc&f=category:management',
    );

    expect(result.current.filters.tokens).toEqual([
      { path: 'category', value: 'management' },
    ]);
  });

  it('keeps any value on a filter that takes free text', () => {
    const { result } = renderWithUrl(
      '/audit-logs?f=action:promote_release&f=actor.type:robot',
    );

    expect(result.current.filters.tokens).toEqual([
      { path: 'action', value: 'promote_release' },
      { path: 'actor.type', value: 'robot' },
    ]);
  });

  it('refuses to write a closed filter value the API cannot express', () => {
    const { result } = renderWithUrl('/audit-logs');

    act(() => result.current.addToken('surface', 'grpc'));

    expect(result.current.filters.tokens).toEqual([]);
  });

  it('keeps every free-text token, not just the last', () => {
    const { result } = renderWithUrl('/audit-logs');

    act(() => {
      result.current.addToken(null, 'occ');
      result.current.addToken(null, 'deploy');
    });

    // `buildAuditQuery` joins them into one `searchPhrase`, so dropping all but
    // the last silently narrows the query.
    expect(result.current.filters.tokens).toEqual([
      { path: null, value: 'occ' },
      { path: null, value: 'deploy' },
    ]);
  });

  it('reads repeated search params back as separate tokens', () => {
    const { result } = renderWithUrl('/audit-logs?search=occ&search=deploy');

    expect(result.current.filters.tokens).toEqual([
      { path: null, value: 'occ' },
      { path: null, value: 'deploy' },
    ]);
  });

  it('reads search as a free-text token', () => {
    const { result } = renderWithUrl('/audit-logs?search=occ');

    expect(result.current.filters.tokens).toEqual([
      { path: null, value: 'occ' },
    ]);
  });

  it('adds and removes tokens', () => {
    const { result } = renderWithUrl('/audit-logs');

    act(() => result.current.addToken('result', 'denied'));
    expect(result.current.filters.tokens).toEqual([
      { path: 'result', value: 'denied' },
    ]);

    act(() => result.current.removeToken('result', 'denied'));
    expect(result.current.filters.tokens).toEqual([]);
  });

  it('does not add the same selection twice', () => {
    const { result } = renderWithUrl('/audit-logs?f=result:denied');

    act(() => result.current.addToken('result', 'denied'));

    expect(result.current.filters.tokens).toHaveLength(1);
  });

  it('keeps every token when several are added before a re-render', () => {
    const { result } = renderWithUrl('/audit-logs');

    // One act, so both handlers run against the same render's state. Drilling
    // on two attributes of an open record does exactly this.
    act(() => {
      result.current.addToken('result', 'denied');
      result.current.addToken('actor.type', 'user');
    });

    expect(result.current.filters.tokens).toEqual([
      { path: 'result', value: 'denied' },
      { path: 'actor.type', value: 'user' },
    ]);
  });

  it('removes the right token when a remove and an add land together', () => {
    const { result } = renderWithUrl(
      '/audit-logs?f=result:denied&f=actor.type:user',
    );

    act(() => {
      result.current.removeToken('result', 'denied');
      result.current.addToken('category', 'management');
    });

    expect(result.current.filters.tokens).toEqual([
      { path: 'actor.type', value: 'user' },
      { path: 'category', value: 'management' },
    ]);
  });

  it('replaces every selection on a path when a lens filters', () => {
    const { result } = renderWithUrl(
      '/audit-logs?f=result:denied&f=actor.type:user',
    );

    act(() => result.current.setPathTokens('result', ['failure']));

    expect(result.current.filters.tokens).toEqual([
      { path: 'actor.type', value: 'user' },
      { path: 'result', value: 'failure' },
    ]);
  });

  it('clears the open record when the query bar changes the filters', () => {
    const { result } = renderWithUrl('/audit-logs?event=e-1');

    expect(result.current.filters.selectedEventId).toBe('e-1');

    act(() => result.current.toggleToken('result', 'denied'));

    // The record may not be in the new result set, so a drawer left open over
    // rows that no longer match would read as a bug.
    expect(result.current.filters.selectedEventId).toBeUndefined();
  });

  it('clears the open record when drilling on one of its attributes', () => {
    const { result } = renderWithUrl('/audit-logs?event=e-1');

    act(() => result.current.addToken('actor.type', 'user'));

    // The point of the drill is the narrowed list, which the drawer sits over.
    expect(result.current.filters.selectedEventId).toBeUndefined();
    expect(result.current.filters.tokens).toEqual([
      { path: 'actor.type', value: 'user' },
    ]);
  });

  it('keeps the default column set out of the URL', () => {
    const { result } = renderWithUrl(
      '/audit-logs?cols=time,actor,action,resource,result',
    );

    act(() => result.current.updateFilters({ columns: AUDIT_DEFAULT_COLUMNS }));

    expect(result.current.filters.columns).toEqual(AUDIT_DEFAULT_COLUMNS);
  });

  it('re-adds the fixed columns when a caller drops them', () => {
    const { result } = renderWithUrl('/audit-logs');

    act(() => result.current.updateFilters({ columns: ['producer'] }));

    expect(result.current.filters.columns).toEqual(
      expect.arrayContaining([
        'time',
        'actor',
        'action',
        'resource',
        'producer',
      ]),
    );
  });

  it('round-trips a custom window', () => {
    const { result } = renderWithUrl('/audit-logs');

    act(() =>
      result.current.updateFilters({
        timeRange: 'custom',
        customStartTime: '2026-09-01T00:00:00.000Z',
        customEndTime: '2026-09-02T00:00:00.000Z',
      }),
    );

    expect(result.current.filters).toMatchObject({
      timeRange: 'custom',
      customStartTime: '2026-09-01T00:00:00.000Z',
      customEndTime: '2026-09-02T00:00:00.000Z',
    });
  });

  it('tracks the selected record without touching the filters', () => {
    const { result } = renderWithUrl('/audit-logs?f=result:denied');

    act(() => result.current.selectEvent('e-9'));

    expect(result.current.filters.selectedEventId).toBe('e-9');
    expect(result.current.filters.tokens).toEqual([
      { path: 'result', value: 'denied' },
    ]);

    act(() => result.current.selectEvent(undefined));
    expect(result.current.filters.selectedEventId).toBeUndefined();
  });
});
