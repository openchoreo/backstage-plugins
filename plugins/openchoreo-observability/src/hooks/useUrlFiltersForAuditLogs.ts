import { useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AUDIT_COLUMNS,
  AUDIT_DEFAULT_COLUMNS,
  AUDIT_FILTER_PATHS,
  AuditFilterPath,
  AuditLogsFilters,
  AuditQueryToken,
  isSupportedFilterValue,
} from '../components/AuditLogs/types';
import { parseUrlTimeRange, writeUrlTimeRange } from '../utils/urlTimeRange';

/** A week of activity is the window an audit review usually opens on. */
export const AUDIT_DEFAULT_TIME_RANGE = '7d';

const VALID_PATHS = new Set<string>(AUDIT_FILTER_PATHS);
const VALID_COLUMNS = new Set(AUDIT_COLUMNS.map(c => c.id));
const FIXED_COLUMNS = AUDIT_COLUMNS.filter(c => c.fixed).map(c => c.id);

/**
 * Serialises one field token as `path:value`. Splitting on the first colon is
 * unambiguous because no filter path contains one, which keeps issuer URLs and
 * user-agent strings readable in the URL rather than escaped into noise.
 */
const encodeToken = (token: AuditQueryToken): string =>
  `${token.path}:${token.value}`;

function decodeToken(raw: string): AuditQueryToken | null {
  const separator = raw.indexOf(':');
  if (separator < 0) return null;
  const path = raw.slice(0, separator);
  const value = raw.slice(separator + 1);
  if (!value || !VALID_PATHS.has(path)) return null;
  const filterPath = path as AuditFilterPath;
  if (!isSupportedFilterValue(filterPath, value)) return null;
  return { path: filterPath, value };
}

/**
 * Reads the token list out of a set of query parameters.
 *
 * Takes the params rather than closing over the current ones so that a token
 * edit can be computed against whatever state React hands the updater, which
 * is what lets two edits in one event both survive.
 */
function readTokens(params: URLSearchParams): AuditQueryToken[] {
  const tokens: AuditQueryToken[] = [];
  for (const raw of params.getAll('f')) {
    const token = decodeToken(raw);
    if (token) tokens.push(token);
  }
  for (const search of params.getAll('search')) {
    if (search) tokens.push({ path: null, value: search });
  }
  return tokens;
}

/** Keeps the column set in the table's own order, fixed columns included. */
function normalizeColumns(ids: string[]): string[] {
  const wanted = new Set([
    ...ids.filter(id => VALID_COLUMNS.has(id)),
    ...FIXED_COLUMNS,
  ]);
  return AUDIT_COLUMNS.filter(c => wanted.has(c.id)).map(c => c.id);
}

const sameSet = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * Audit Logs filter state, held in the URL so a query is a link — which is
 * what makes a finding shareable with the person who has to act on it.
 *
 * Query parameters:
 * - `f`: repeated `path:value` filter selections (same path ORs, different paths AND)
 * - `search`: free text, sent as `searchPhrase`
 * - `timeRange` + `from`/`to`: the window (see `parseUrlTimeRange`)
 * - `cols`: comma-separated column ids; absent means the default set
 * - `sort`: `desc` (absent means oldest first, which is how a trail is read)
 * - `live`: `true` to poll the newest page
 * - `event`: the `event_id` whose detail drawer is open
 */
export function useUrlFiltersForAuditLogs() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<AuditLogsFilters>(() => {
    const tokens = readTokens(searchParams);

    const { timeRange, customStartTime, customEndTime } = parseUrlTimeRange(
      searchParams,
      AUDIT_DEFAULT_TIME_RANGE,
    );

    const colsParam = searchParams.get('cols');
    const columns = colsParam
      ? normalizeColumns(colsParam.split(',').filter(Boolean))
      : [...AUDIT_DEFAULT_COLUMNS];

    return {
      tokens,
      timeRange,
      customStartTime,
      customEndTime,
      columns,
      sortOrder: searchParams.get('sort') === 'desc' ? 'desc' : 'asc',
      selectedEventId: searchParams.get('event') ?? undefined,
    };
  }, [searchParams]);

  // `setSearchParams` navigates rather than queueing state, and even its
  // updater form is handed the render's own params — so two edits dispatched
  // from one event both build on the pre-event URL and the second drops the
  // first. Keyed by `from` (memoised on `location.search`) so a moved location
  // invalidates it.
  const pendingRef = useRef<{
    from: URLSearchParams;
    value: URLSearchParams;
  } | null>(null);

  const update = useCallback(
    (mutator: (params: URLSearchParams) => void) => {
      const pending = pendingRef.current;
      const base =
        pending && pending.from === searchParams ? pending.value : searchParams;

      const next = new URLSearchParams(base);
      mutator(next);

      pendingRef.current = { from: searchParams, value: next };
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const writeTokens = useCallback(
    (params: URLSearchParams, tokens: AuditQueryToken[]) => {
      params.delete('f');
      params.delete('search');
      for (const token of tokens) {
        // Appended, not set: `buildAuditQuery` joins several free-text tokens
        // into one `searchPhrase`, so setting would drop all but the last.
        if (token.path === null) params.append('search', token.value);
        // Every write funnels through here, so a value a closed filter cannot
        // express is refused once rather than at each caller that can offer one.
        else if (isSupportedFilterValue(token.path, token.value)) {
          params.append('f', encodeToken(token));
        }
      }
    },
    [],
  );

  const updateFilters = useCallback(
    (next: Partial<AuditLogsFilters>) => {
      update(params => {
        if (next.tokens !== undefined) {
          writeTokens(params, next.tokens);
          // A changed query invalidates the open record: it may not be in the
          // new result set, and a drawer over rows that no longer match reads
          // as a bug rather than as a pin.
          if (next.selectedEventId === undefined) params.delete('event');
        }

        writeUrlTimeRange(params, next, AUDIT_DEFAULT_TIME_RANGE);

        if (next.columns !== undefined) {
          const columns = normalizeColumns(next.columns);
          if (sameSet(columns, AUDIT_DEFAULT_COLUMNS)) params.delete('cols');
          else params.set('cols', columns.join(','));
        }

        if (next.sortOrder !== undefined) {
          if (next.sortOrder === 'asc') params.delete('sort');
          else params.set('sort', next.sortOrder);
        }

        if (next.selectedEventId !== undefined) {
          if (next.selectedEventId) params.set('event', next.selectedEventId);
          else params.delete('event');
        }
      });
    },
    [update, writeTokens],
  );

  /**
   * Rewrites the token list from whatever it is when the update is applied,
   * rather than from what it was when the handler was created. Every token edit
   * goes through here so that a burst of them composes instead of racing.
   */
  const updateTokens = useCallback(
    (mutate: (tokens: AuditQueryToken[]) => AuditQueryToken[]) => {
      update(params => {
        writeTokens(params, mutate(readTokens(params)));
        params.delete('event');
      });
    },
    [update, writeTokens],
  );

  const addToken = useCallback(
    (path: AuditFilterPath | null, value: string) => {
      if (!value) return;
      updateTokens(tokens =>
        tokens.some(token => token.path === path && token.value === value)
          ? tokens
          : [...tokens, { path, value }],
      );
    },
    [updateTokens],
  );

  const removeToken = useCallback(
    (path: AuditFilterPath | null, value: string) => {
      updateTokens(tokens =>
        tokens.filter(token => !(token.path === path && token.value === value)),
      );
    },
    [updateTokens],
  );

  const toggleToken = useCallback(
    (path: AuditFilterPath | null, value: string) => {
      if (!value) return;
      updateTokens(tokens =>
        tokens.some(token => token.path === path && token.value === value)
          ? tokens.filter(
              token => !(token.path === path && token.value === value),
            )
          : [...tokens, { path, value }],
      );
    },
    [updateTokens],
  );

  /** Replaces every selection on one path — how a lens tile filters. */
  const setPathTokens = useCallback(
    (path: AuditFilterPath, values: string[]) => {
      updateTokens(tokens => [
        ...tokens.filter(token => token.path !== path),
        ...values.map(value => ({ path, value })),
      ]);
    },
    [updateTokens],
  );

  const clearTokens = useCallback(() => {
    updateTokens(() => []);
  }, [updateTokens]);

  const selectEvent = useCallback(
    (eventId?: string) => {
      updateFilters({ selectedEventId: eventId ?? '' });
    },
    [updateFilters],
  );

  return {
    filters,
    updateFilters,
    addToken,
    removeToken,
    toggleToken,
    setPathTokens,
    clearTokens,
    selectEvent,
  };
}
