import {
  PREFETCHED_LOGS_MAX_ROWS,
  PREFETCHED_LOGS_MAX_ROWS_PINNED,
  PREFETCHED_LOGS_PINNED_WINDOW_MS,
  buildPrefetchedLogs,
  type PrefetchableLogRow,
} from './scope';

// Helpers
const row = (
  message: string,
  level: string,
  timestamp: string,
  componentName = 'lab-api-service',
): PrefetchableLogRow => ({
  log: message,
  level,
  timestamp,
  metadata: { componentName },
});

describe('buildPrefetchedLogs — un-pinned path (regression coverage)', () => {
  // The un-pinned path is what the floating "Ask Perch" pill uses on
  // the Logs tab. It must keep mirroring the visible page (no
  // severity filtering, no time-window filtering) so the agent's
  // first-turn picture matches what the user is staring at.

  it('keeps every level when no pin context is provided', () => {
    const rows = [
      row('boom', 'ERROR', '2026-05-15T10:00:00Z'),
      row('GET /api/notes status=200', 'INFO', '2026-05-15T10:00:01Z'),
      row('debug detail', 'DEBUG', '2026-05-15T10:00:02Z'),
    ];
    const out = buildPrefetchedLogs(rows);
    expect(out).toHaveLength(3);
    expect(out!.map(r => r.level)).toEqual(['ERROR', 'INFO', 'DEBUG']);
  });

  it('caps at PREFETCHED_LOGS_MAX_ROWS when un-pinned', () => {
    // Generate 60 rows; helper should keep the first 50.
    const rows = Array.from({ length: 60 }, (_, i) =>
      row(
        `request ${i}`,
        'INFO',
        `2026-05-15T10:00:${String(i).padStart(2, '0')}Z`,
      ),
    );
    const out = buildPrefetchedLogs(rows);
    expect(out).toHaveLength(PREFETCHED_LOGS_MAX_ROWS);
  });

  it('returns undefined when no rows match (empty list)', () => {
    expect(buildPrefetchedLogs([])).toBeUndefined();
    expect(buildPrefetchedLogs(undefined)).toBeUndefined();
  });
});

describe('buildPrefetchedLogs — pinned path', () => {
  // This is the behaviour the user's curl example exposed: 50 rows,
  // 48 of them INFO request access logs, the actual ERROR/WARN
  // siblings drowned out. With pin context set, the helper must
  // narrow to ERROR/WARN within ±2 min of the pinned timestamp,
  // keep the pinned row, and cap at 20.

  const PIN_TIME = '2026-05-11T02:14:53Z';
  const PIN_MS = Date.parse(PIN_TIME);

  it('drops INFO and DEBUG rows when pin is set', () => {
    // Mirrors the user's real curl: two ERRORs at the pinned time,
    // dozens of INFO request access logs in the same window.
    const rows: PrefetchableLogRow[] = [
      row('postgres connection failed', 'ERROR', PIN_TIME),
      row('redis unavailable', 'WARN', PIN_TIME),
      ...Array.from({ length: 30 }, (_, i) =>
        row(
          `GET /api/notes status=200 #${i}`,
          'INFO',
          new Date(PIN_MS + (i + 1) * 1000).toISOString(),
        ),
      ),
    ];
    const out = buildPrefetchedLogs(rows, {
      pin: { timestamp: PIN_TIME, message: 'redis unavailable' },
    });
    // Two survivors: the ERROR and the WARN.
    expect(out).toHaveLength(2);
    expect(out!.every(r => ['ERROR', 'WARN'].includes(r.level ?? ''))).toBe(
      true,
    );
  });

  it('keeps severity-passing rows when their timestamp is unparseable', () => {
    // Older observer releases occasionally emit malformed timestamp
    // strings (``"unknown"`` / blank) on otherwise-valid ERROR rows.
    // Previously the time-window check did ``rowMs === undefined →
    // return false`` and silently dropped these. The pinned-mode
    // helper is specifically meant to surface ERROR/WARN evidence —
    // dropping it because of a parse failure is exactly the wrong
    // behaviour. Pin that an unparseable timestamp now BYPASSES the
    // window check rather than failing it.
    const rows = [
      // ERROR row with a usable timestamp inside the window — control.
      row(
        'inside-window err',
        'ERROR',
        new Date(PIN_MS + 60 * 1000).toISOString(),
      ),
      // ERROR row with a junk timestamp — must survive.
      row('garbled-ts err', 'ERROR', 'not-a-real-rfc3339-string'),
      // ERROR row with an empty timestamp — also survives (the outer
      // ``pinTimeMs !== undefined && row.timestamp`` guard short-
      // circuits because ``row.timestamp`` is falsy).
      row('empty-ts err', 'ERROR', ''),
    ];
    const out = buildPrefetchedLogs(rows, { pin: { timestamp: PIN_TIME } });
    expect(out!.map(r => r.message)).toEqual([
      'inside-window err',
      'garbled-ts err',
      'empty-ts err',
    ]);
  });

  it('keeps only rows within ±2 minutes of the pinned timestamp', () => {
    const inside = new Date(PIN_MS + 90 * 1000).toISOString(); // +1.5 min
    const justOut = new Date(PIN_MS + 121 * 1000).toISOString(); // +2 min 1 s
    const wayOut = new Date(PIN_MS + 10 * 60 * 1000).toISOString(); // +10 min
    const rows = [
      row('inside-window err', 'ERROR', inside),
      row('just-outside err', 'ERROR', justOut),
      row('way-outside err', 'ERROR', wayOut),
    ];
    const out = buildPrefetchedLogs(rows, { pin: { timestamp: PIN_TIME } });
    expect(out!.map(r => r.message)).toEqual(['inside-window err']);
    // Cross-check the window constant matches the test fixture.
    expect(PREFETCHED_LOGS_PINNED_WINDOW_MS).toBe(2 * 60 * 1000);
  });

  it('always keeps the pinned row even when its level would otherwise be filtered out', () => {
    // User clicks Investigate on a DEBUG row. The severity filter
    // would normally drop it; the pin-match override keeps it.
    const pinnedMsg = 'debug: handler picked variant X for request rid=abc';
    const rows = [
      row('unrelated ERROR within window', 'ERROR', PIN_TIME),
      row(pinnedMsg, 'DEBUG', PIN_TIME),
    ];
    const out = buildPrefetchedLogs(rows, {
      pin: { timestamp: PIN_TIME, message: pinnedMsg },
    });
    const messages = out!.map(r => r.message);
    expect(messages).toContain(pinnedMsg);
    expect(messages).toContain('unrelated ERROR within window');
  });

  it('promotes trace-linked rows regardless of severity or time-window', () => {
    // A debug breadcrumb logged before the symptom that carries the
    // same trace_id should survive even if it's outside the time
    // window — the trace is a strong causal link the model uses to
    // bridge logs → traces.
    const TRACE = 'cafebabe1234567890abcdef';
    const fiveMinutesEarlier = new Date(PIN_MS - 5 * 60 * 1000).toISOString();
    const rows = [
      row(`ERROR boom trace_id=${TRACE}`, 'ERROR', PIN_TIME),
      row(`DEBUG handler enter trace_id=${TRACE}`, 'DEBUG', fiveMinutesEarlier),
    ];
    const out = buildPrefetchedLogs(rows, {
      pin: { timestamp: PIN_TIME, traceId: TRACE },
    });
    expect(out).toHaveLength(2);
    expect(out!.some(r => r.level === 'DEBUG')).toBe(true);
  });

  it('caps at PREFETCHED_LOGS_MAX_ROWS_PINNED (smaller than the unpinned cap)', () => {
    // 30 ERROR rows all within the window — helper should cap at 20.
    const rows = Array.from({ length: 30 }, (_, i) =>
      row(
        `ERROR boom #${i}`,
        'ERROR',
        new Date(PIN_MS + (i + 1) * 1000).toISOString(),
      ),
    );
    const out = buildPrefetchedLogs(rows, { pin: { timestamp: PIN_TIME } });
    expect(out).toHaveLength(PREFETCHED_LOGS_MAX_ROWS_PINNED);
    expect(PREFETCHED_LOGS_MAX_ROWS_PINNED).toBe(20);
  });

  it('treats level matching case-insensitively', () => {
    // Some indexers normalise to upper, some don't. The pinned-path
    // allow-list MUST cope with "warn" / "Warning" / "ERROR" etc.
    const rows = [
      row('a', 'warn', PIN_TIME),
      row('b', 'Warning', PIN_TIME),
      row('c', 'error', PIN_TIME),
      row('d', 'INFO', PIN_TIME),
    ];
    const out = buildPrefetchedLogs(rows, { pin: { timestamp: PIN_TIME } });
    expect(out!.map(r => r.message).sort()).toEqual(['a', 'b', 'c']);
  });

  it('reproduces the user-reported case: 50 rows in, ~3 rows out', () => {
    // Direct mirror of the curl the user shared: pinned row is a WARN
    // about redis being unavailable, page has all four levels
    // selected, ~48 INFO request access logs accompany the 2
    // genuine errors. We expect the helper to leave only the
    // genuine errors + the pinned row.
    const pinnedMsg =
      'WARN redis unavailable, continuing without cache addr=lab-redis...';
    const rows: PrefetchableLogRow[] = [
      row(
        'postgres connection failed, will retry on first query',
        'ERROR',
        PIN_TIME,
      ),
      row(pinnedMsg, 'ERROR', PIN_TIME), // user's table reported WARN as ERROR — observer-side variance, but the pinned-row override keeps it either way
      row('api-service listening on :8080', 'INFO', PIN_TIME),
      // Forty-seven request access logs all in the window.
      ...Array.from({ length: 47 }, (_, i) =>
        row(
          `request method=GET path=/api/notes status=200 #${i}`,
          'INFO',
          new Date(PIN_MS + 60_000 + i * 500).toISOString(),
        ),
      ),
    ];
    const out = buildPrefetchedLogs(rows, {
      pin: { timestamp: PIN_TIME, message: pinnedMsg },
    });
    // We expect only the ERROR rows + the pinned-by-message row.
    // Either two or three depending on dedup; both are huge wins over 50.
    expect(out!.length).toBeLessThanOrEqual(3);
    expect(out!.every(r => r.level !== 'INFO')).toBe(true);
  });
});
