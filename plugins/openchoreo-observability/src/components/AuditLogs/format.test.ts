import {
  actorInitials,
  formatTotal,
  relativeAge,
  scopeSegments,
  shortUserAgent,
  surfaceLabel,
} from './format';

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

describe('surfaceLabel', () => {
  it('describes the surfaces it knows', () => {
    expect(surfaceLabel('mcp')).toBe('via MCP');
    expect(surfaceLabel('rest')).toBe('via the REST API');
  });

  it('names an unknown surface rather than calling it REST', () => {
    expect(surfaceLabel('grpc')).toBe('via grpc');
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

  it('names Edge by its own token, which trails the Chrome one', () => {
    expect(
      shortUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
      ),
    ).toBe('Edge 140');
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
