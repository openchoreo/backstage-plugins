import {
  actorInitials,
  bucketTick,
  formatTotal,
  relativeAge,
  resultLabel,
  scopeSegments,
  shortUserAgent,
  verbOf,
} from './format';

describe('verbOf', () => {
  it('reads the leading verb of an action name', () => {
    expect(verbOf('create_project')).toBe('create');
    expect(verbOf('read_audit_log')).toBe('read');
  });

  it('gives no verb rather than guessing one', () => {
    expect(verbOf('promote_release')).toBeUndefined();
    expect(verbOf('')).toBeUndefined();
    expect(verbOf(undefined)).toBeUndefined();
  });
});

describe('resultLabel', () => {
  it('shortens only the outcome too long for a pill', () => {
    expect(resultLabel('unauthenticated')).toBe('unauth');
    expect(resultLabel('success')).toBe('success');
    expect(resultLabel('denied')).toBe('denied');
  });
});

describe('relativeAge', () => {
  const now = Date.parse('2026-09-14T12:00:00.000Z');
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it('steps up a unit as the age crosses it', () => {
    expect(relativeAge(ago(30_000), now)).toBe('30s ago');
    expect(relativeAge(ago(5 * 60_000), now)).toBe('5m ago');
    expect(relativeAge(ago(3 * 3_600_000), now)).toBe('3h ago');
    expect(relativeAge(ago(2 * 86_400_000), now)).toBe('2d ago');
  });

  it('never reports a negative age for a clock slightly ahead', () => {
    expect(relativeAge(ago(-5_000), now)).toBe('0s ago');
  });
});

describe('shortUserAgent', () => {
  it('pulls the recognisable token out of a browser agent', () => {
    expect(
      shortUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      ),
    ).toBe('Chrome 140');
    // Safari reports itself through `Version`, not its own name.
    expect(
      shortUserAgent(
        'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15',
      ),
    ).toBe('Safari 17');
  });

  it('keeps the leading token of an agent that names itself', () => {
    expect(shortUserAgent('occ/1.4.2 (darwin/arm64)')).toBe('occ/1.4.2');
  });
});

describe('actorInitials', () => {
  it('builds initials from a structured local part', () => {
    expect(actorInitials({ type: 'user', id: 'dilani.perera@x.dev' })).toBe(
      'DP',
    );
    expect(actorInitials({ type: 'user', id: 'anne-marie@x.dev' })).toBe('AM');
  });

  it('treats any separator as a word break, including in an opaque id', () => {
    expect(actorInitials({ type: 'service_account', id: 'ci-runner' })).toBe(
      'CR',
    );
    expect(actorInitials({ type: 'user', id: '01a08565-83dc' })).toBe('08');
  });

  it('falls back to the first characters of a single-word id', () => {
    expect(actorInitials({ type: 'service_account', id: 'argocd' })).toBe('AR');
  });

  it('marks an anonymous actor rather than inventing initials', () => {
    expect(actorInitials({ type: 'anonymous', id: '' })).toBe('?');
  });
});

describe('scopeSegments', () => {
  it('lists the hierarchy outermost first, skipping absent levels', () => {
    expect(scopeSegments({ namespace: 'default', component: 'api' })).toEqual([
      'default',
      'api',
    ]);
  });

  it('is empty when the record carries no resource', () => {
    expect(scopeSegments(undefined)).toEqual([]);
    expect(scopeSegments(null)).toEqual([]);
  });
});

describe('formatTotal', () => {
  it('groups a count for reading', () => {
    expect(formatTotal(1517)).toBe((1517).toLocaleString());
    expect(formatTotal(0)).toBe('0');
  });
});

describe('bucketTick', () => {
  it('drops the hour once the window is wider than two days', () => {
    const wide = bucketTick('2026-09-03T10:00:00.000Z', 7 * 86_400_000);
    expect(wide).toMatch(/Sep/);
    expect(wide).not.toMatch(/:/);
  });

  it('keeps the time for a window inside two days', () => {
    expect(bucketTick('2026-09-03T10:00:00.000Z', 3_600_000)).toMatch(/:/);
  });

  it('returns nothing for a timestamp it cannot read', () => {
    expect(bucketTick('not-a-date', 0)).toBe('');
  });
});
