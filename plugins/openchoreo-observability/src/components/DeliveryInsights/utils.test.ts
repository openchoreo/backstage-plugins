import { fillSeriesGaps, mapWithConcurrency } from './utils';

describe('fillSeriesGaps', () => {
  const buckets = [
    { bucketStart: '2026-07-01T00:00:00.000Z' },
    { bucketStart: '2026-07-02T00:00:00.000Z' },
    { bucketStart: '2026-07-03T00:00:00.000Z' },
  ];

  it('inserts nulls for buckets the sparse series omits', () => {
    // Only the first and last bucket had deployments with commit provenance.
    const series = [
      { bucketStart: '2026-07-01T00:00:00.000Z', p50Ms: 100 },
      { bucketStart: '2026-07-03T00:00:00.000Z', p50Ms: 300 },
    ];
    expect(fillSeriesGaps(buckets, series, ['p50Ms'])).toEqual([
      { bucketStart: '2026-07-01T00:00:00.000Z', p50Ms: 100 },
      // Without this null the chart would draw straight from 100 to 300,
      // implying the middle day was measured.
      { bucketStart: '2026-07-02T00:00:00.000Z', p50Ms: null },
      { bucketStart: '2026-07-03T00:00:00.000Z', p50Ms: 300 },
    ]);
  });

  it('fills every requested value key', () => {
    const series = [
      { bucketStart: '2026-07-02T00:00:00.000Z', p50Ms: 1, p95Ms: 9 },
    ];
    expect(fillSeriesGaps(buckets, series, ['p50Ms', 'p95Ms'])).toEqual([
      { bucketStart: '2026-07-01T00:00:00.000Z', p50Ms: null, p95Ms: null },
      { bucketStart: '2026-07-02T00:00:00.000Z', p50Ms: 1, p95Ms: 9 },
      { bucketStart: '2026-07-03T00:00:00.000Z', p50Ms: null, p95Ms: null },
    ]);
  });

  it('returns an empty series unchanged so the chart shows its empty state', () => {
    expect(fillSeriesGaps(buckets, [], ['p50Ms'])).toEqual([]);
    expect(fillSeriesGaps(buckets, undefined, ['p50Ms'])).toEqual([]);
  });

  it('plots the series as-is when there is no reference window', () => {
    const series = [{ bucketStart: '2026-07-09T00:00:00.000Z', meanMs: 5 }];
    expect(fillSeriesGaps(undefined, series, ['meanMs'])).toEqual(series);
    expect(fillSeriesGaps([], series, ['meanMs'])).toEqual(series);
  });

  it('drops points that fall outside the reference buckets', () => {
    const series = [
      { bucketStart: '2026-06-30T00:00:00.000Z', p50Ms: 1 },
      { bucketStart: '2026-07-02T00:00:00.000Z', p50Ms: 2 },
    ];
    const result = fillSeriesGaps(buckets, series, ['p50Ms']);
    expect(result).toHaveLength(3);
    expect(result.map(r => r.p50Ms)).toEqual([null, 2, null]);
  });
});

describe('mapWithConcurrency', () => {
  it('preserves input order regardless of completion order', async () => {
    const items = [30, 10, 20, 0];
    const result = await mapWithConcurrency(items, 2, async value => {
      await new Promise(resolve => setTimeout(resolve, value));
      return value * 2;
    });
    expect(result).toEqual([60, 20, 40, 0]);
  });

  it('never exceeds the concurrency limit', async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency(
      Array.from({ length: 20 }, (_, i) => i),
      3,
      async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise(resolve => setTimeout(resolve, 1));
        inFlight -= 1;
      },
    );
    expect(peak).toBeLessThanOrEqual(3);
    // Sanity check that it did run in parallel rather than serially.
    expect(peak).toBeGreaterThan(1);
  });

  it('visits every item', async () => {
    const seen: number[] = [];
    const items = Array.from({ length: 13 }, (_, i) => i);
    await mapWithConcurrency(items, 5, async value => {
      seen.push(value);
    });
    expect(seen.sort((a, b) => a - b)).toEqual(items);
  });

  it('handles an empty input without spawning workers', async () => {
    const fn = jest.fn();
    await expect(mapWithConcurrency([], 4, fn)).resolves.toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });
});
