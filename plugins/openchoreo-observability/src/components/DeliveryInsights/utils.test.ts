import { createTheme } from '@material-ui/core/styles';
import {
  classificationColors,
  dataAvailabilityWarning,
  deltaColor,
  fillSeriesGaps,
  granularitiesForRange,
  resolveGranularity,
  mapWithConcurrency,
  measuredRates,
  nullUnmeasuredRates,
} from './utils';

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

describe('change failure rate buckets with no deployments', () => {
  // The observer zero-fills this series, so an idle day arrives as rate 0 rather
  // than absent -- the shape that made a three-week gap render as a flat 0%.
  const series = [
    { bucketStart: '2026-09-08T00:00:00Z', rate: 0, failed: 0, total: 0 },
    { bucketStart: '2026-09-09T00:00:00Z', rate: 0.25, failed: 1, total: 4 },
    { bucketStart: '2026-09-10T00:00:00Z', rate: 0, failed: 0, total: 3 },
  ];

  it('nulls a rate no deployment measured, keeping a real zero', () => {
    expect(nullUnmeasuredRates(series).map(p => p.rate)).toEqual([
      null,
      0.25,
      0,
    ]);
  });

  it('keeps the other fields so the tooltip still has its counts', () => {
    expect(nullUnmeasuredRates(series)[1]).toMatchObject({
      bucketStart: '2026-09-09T00:00:00Z',
      failed: 1,
      total: 4,
    });
  });

  it('drops unmeasured buckets from the sparkline rather than nulling them', () => {
    // Sparkline takes number[] and scales on min/max, so a null would drag the
    // baseline down instead of being ignored.
    expect(measuredRates(series)).toEqual([0.25, 0]);
  });

  it('handles an absent series', () => {
    expect(nullUnmeasuredRates(undefined)).toEqual([]);
    expect(measuredRates(undefined)).toEqual([]);
  });
});

describe('dataAvailabilityWarning', () => {
  it('says nothing when the observer collects everything', () => {
    expect(
      dataAvailabilityWarning({
        collecting: true,
        deliveryEvents: true,
      }),
    ).toBeNull();
  });

  it('says nothing when the field is absent', () => {
    // An observer predating the field may well be collecting; a wrong warning
    // is worse than none.
    expect(dataAvailabilityWarning(undefined)).toBeNull();
  });

  it('warns that nothing is being collected when aggregation is off', () => {
    const msg = dataAvailabilityWarning({ collecting: false });
    expect(msg).toContain('not collecting');
    expect(msg).toContain('featurePreview.deliveryInsights.enabled');
  });

  it('takes not collecting as the more fundamental of the two', () => {
    // With nothing collecting, adapter capability is moot; reporting it would
    // point someone at the wrong problem.
    const msg = dataAvailabilityWarning({
      collecting: false,
      deliveryEvents: false,
    });
    expect(msg).toContain('featurePreview.deliveryInsights.enabled');
    expect(msg).not.toContain('delivery event sweep');
  });

  it('names the three affected metrics when only the events source is off', () => {
    const msg = dataAvailabilityWarning({
      collecting: true,
      deliveryEvents: false,
    });
    expect(msg).toContain('cannot serve the delivery event sweep');
    // MTTR still works off incidents, so the warning must not imply otherwise.
    expect(msg).toContain('Mean time to recovery');
  });
});

describe('granularity for a window', () => {
  // A window and a bucket size only make a chart together: a year of daily
  // buckets is 365 marks in a card, a week of monthly buckets is one.
  it.each([
    [7, ['daily']],
    [30, ['daily', 'weekly']],
    [90, ['daily', 'weekly', 'monthly']],
    [365, ['weekly', 'monthly']],
  ])('offers the sizes that chart for %i days', (days, expected) => {
    expect(granularitiesForRange(days)).toEqual(expected);
  });

  it('never leaves the control with nothing to choose', () => {
    expect(granularitiesForRange(1)).toEqual(['daily']);
  });

  it('keeps a granularity that still fits the new range', () => {
    expect(resolveGranularity(90, 'weekly')).toBe('weekly');
  });

  it('moves off one the new range no longer offers', () => {
    // 12 months has no daily option; monthly is the coarsest that fits.
    expect(resolveGranularity(365, 'daily')).toBe('monthly');
  });
});

// Hard-coded light-theme hexes were unreadable against the dark theme, so both
// the rating chips and the deltas now come off the palette.
describe('theme-derived colors', () => {
  const light = createTheme({ palette: { type: 'light' } });
  const dark = createTheme({ palette: { type: 'dark' } });

  it('reads the delta colors off the palette', () => {
    expect(deltaColor(light, true)).toBe(light.palette.success.main);
    expect(deltaColor(light, false)).toBe(light.palette.error.main);
    expect(deltaColor(dark, true)).toBe(dark.palette.success.main);
  });

  it('gives every classification a distinct chip color', () => {
    const colors = classificationColors(light);
    const texts = Object.values(colors).map(c => c.text);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('flips the label shade with the theme so the chips stay legible', () => {
    expect(classificationColors(light).Elite.text).toBe(
      light.palette.success.dark,
    );
    expect(classificationColors(dark).Elite.text).toBe(
      dark.palette.success.light,
    );
  });
});
