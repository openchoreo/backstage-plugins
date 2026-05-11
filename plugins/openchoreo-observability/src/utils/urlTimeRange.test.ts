import { parseUrlTimeRange, writeUrlTimeRange } from './urlTimeRange';

const params = (input: string) => new URLSearchParams(input);

describe('parseUrlTimeRange', () => {
  it('defaults to 10m when no timeRange is present', () => {
    expect(parseUrlTimeRange(params(''))).toEqual({
      timeRange: '10m',
      customStartTime: undefined,
      customEndTime: undefined,
    });
  });

  it('returns the preset for any value listed in TIME_RANGE_OPTIONS', () => {
    expect(parseUrlTimeRange(params('timeRange=30d')).timeRange).toBe('30d');
    expect(parseUrlTimeRange(params('timeRange=7d')).timeRange).toBe('7d');
  });

  it('falls back to default when timeRange value is unknown', () => {
    expect(parseUrlTimeRange(params('timeRange=99x')).timeRange).toBe('10m');
  });

  it('returns custom range when timeRange=custom and from/to are valid ISO', () => {
    const search = params(
      'timeRange=custom&from=2026-05-04T08:13:27.437Z&to=2026-05-06T09:13:27.437Z',
    );
    expect(parseUrlTimeRange(search)).toEqual({
      timeRange: 'custom',
      customStartTime: '2026-05-04T08:13:27.437Z',
      customEndTime: '2026-05-06T09:13:27.437Z',
    });
  });

  it('falls back to default when timeRange=custom but from/to are missing', () => {
    expect(parseUrlTimeRange(params('timeRange=custom')).timeRange).toBe('10m');
    expect(
      parseUrlTimeRange(
        params('timeRange=custom&from=2026-05-04T08:13:27.437Z'),
      ).timeRange,
    ).toBe('10m');
  });

  it('falls back to default when timeRange=custom but from/to are not parseable', () => {
    const search = params(
      'timeRange=custom&from=not-a-date&to=also-not-a-date',
    );
    expect(parseUrlTimeRange(search).timeRange).toBe('10m');
  });
});

describe('writeUrlTimeRange', () => {
  it('omits the default preset from the URL', () => {
    const p = params('timeRange=7d');
    writeUrlTimeRange(p, { timeRange: '10m' });
    expect(p.has('timeRange')).toBe(false);
  });

  it('sets the preset for non-default values', () => {
    const p = params('');
    writeUrlTimeRange(p, { timeRange: '30d' });
    expect(p.get('timeRange')).toBe('30d');
  });

  it('writes from/to when switching to custom', () => {
    const p = params('');
    writeUrlTimeRange(p, {
      timeRange: 'custom',
      customStartTime: '2026-05-04T08:13:27.437Z',
      customEndTime: '2026-05-06T09:13:27.437Z',
    });
    expect(p.get('timeRange')).toBe('custom');
    expect(p.get('from')).toBe('2026-05-04T08:13:27.437Z');
    expect(p.get('to')).toBe('2026-05-06T09:13:27.437Z');
  });

  it('clears stale from/to when switching away from custom', () => {
    const p = params(
      'timeRange=custom&from=2026-05-04T08:13:27.437Z&to=2026-05-06T09:13:27.437Z',
    );
    writeUrlTimeRange(p, { timeRange: '7d' });
    expect(p.get('timeRange')).toBe('7d');
    expect(p.has('from')).toBe(false);
    expect(p.has('to')).toBe(false);
  });

  it('clears from/to when switching back to default preset', () => {
    const p = params(
      'timeRange=custom&from=2026-05-04T08:13:27.437Z&to=2026-05-06T09:13:27.437Z',
    );
    writeUrlTimeRange(p, { timeRange: '10m' });
    expect(p.has('timeRange')).toBe(false);
    expect(p.has('from')).toBe(false);
    expect(p.has('to')).toBe(false);
  });

  it('updates only the keys provided in the partial', () => {
    const p = params('timeRange=7d&components=a,b&env=prod');
    writeUrlTimeRange(p, { timeRange: '24h' });
    expect(p.get('timeRange')).toBe('24h');
    // Untouched keys remain
    expect(p.get('components')).toBe('a,b');
    expect(p.get('env')).toBe('prod');
  });

  it('deletes from when customStartTime is explicitly set to empty', () => {
    const p = params('from=2026-05-04T08:13:27.437Z');
    writeUrlTimeRange(p, { customStartTime: '' });
    expect(p.has('from')).toBe(false);
  });

  it('deletes to when customEndTime is explicitly set to empty', () => {
    const p = params('to=2026-05-06T09:13:27.437Z');
    writeUrlTimeRange(p, { customEndTime: '' });
    expect(p.has('to')).toBe(false);
  });

  it('is a no-op when called with an empty partial', () => {
    const p = params('timeRange=7d&from=a&to=b');
    writeUrlTimeRange(p, {});
    expect(p.get('timeRange')).toBe('7d');
    expect(p.get('from')).toBe('a');
    expect(p.get('to')).toBe('b');
  });
});
