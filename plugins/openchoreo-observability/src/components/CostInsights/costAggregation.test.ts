import type { CostItem, CostRecommendationItem } from '../../types';
import {
  deriveLevel,
  expandSelection,
  dimensionOf,
  totalCost,
  percentChange,
  monthDurationMs,
  forecastThisMonth,
  aggregateRows,
  computeSummary,
  buildSeries,
  buildForecast,
  buildCostInsightsData,
} from './costAggregation';

const costItem = (over: Partial<CostItem>): CostItem => ({
  component: 'comp',
  startTime: '2026-07-01T00:00:00.000Z',
  endTime: '2026-07-01T01:00:00.000Z',
  environment: 'dev',
  project: 'proj',
  namespace: 'default',
  cpuCost: 0,
  memoryCost: 0,
  efficiency: 0,
  ...over,
});

describe('deriveLevel', () => {
  it('derives the level from breadcrumb depth', () => {
    expect(deriveLevel({ namespace: 'ns' })).toBe('namespace');
    expect(deriveLevel({ namespace: 'ns', project: 'p' })).toBe('project');
    expect(deriveLevel({ namespace: 'ns', project: 'p', component: 'c' })).toBe(
      'component',
    );
  });
});

describe('expandSelection', () => {
  it('expands namespaces when no project/component is selected', () => {
    expect(
      expandSelection({
        namespaces: ['a', 'b'],
        projects: [],
        components: [],
      }),
    ).toEqual({
      level: 'namespace',
      scopes: [{ namespace: 'a' }, { namespace: 'b' }],
    });
  });

  it('expands projects and ignores namespaces once a project is picked', () => {
    expect(
      expandSelection({
        namespaces: ['a'],
        projects: [{ namespace: 'a', name: 'p' }],
        components: [],
      }),
    ).toEqual({
      level: 'project',
      scopes: [{ namespace: 'a', project: 'p' }],
    });
  });

  it('expands components and takes precedence over projects', () => {
    expect(
      expandSelection({
        namespaces: ['a'],
        projects: [{ namespace: 'a', name: 'p' }],
        components: [{ namespace: 'a', project: 'p', name: 'c' }],
      }),
    ).toEqual({
      level: 'component',
      scopes: [{ namespace: 'a', project: 'p', component: 'c' }],
    });
  });

  it('yields an empty namespace scope list when nothing is selected', () => {
    expect(
      expandSelection({ namespaces: [], projects: [], components: [] }),
    ).toEqual({ level: 'namespace', scopes: [] });
  });
});

describe('dimensionOf', () => {
  const item = costItem({ project: 'p1', component: 'c1', environment: 'e1' });
  it('groups by project / component / environment per level', () => {
    expect(dimensionOf(item, 'namespace')).toBe('p1');
    expect(dimensionOf(item, 'project')).toBe('c1');
    expect(dimensionOf(item, 'component')).toBe('e1');
  });
});

describe('totalCost & percentChange', () => {
  it('sums cpu + memory across items', () => {
    expect(
      totalCost([
        costItem({ cpuCost: 10, memoryCost: 12 }),
        costItem({ cpuCost: 2, memoryCost: 4 }),
      ]),
    ).toBe(28);
  });

  it('computes percent change and guards divide-by-zero', () => {
    expect(percentChange(110, 100)).toBeCloseTo(10);
    expect(percentChange(90, 100)).toBeCloseTo(-10);
    expect(percentChange(5, 0)).toBeNull();
    expect(percentChange(5, undefined)).toBeNull();
  });
});

describe('forecastThisMonth', () => {
  it('extrapolates the window rate to the calendar month', () => {
    const now = new Date('2026-07-15T00:00:00.000Z');
    const monthMs = monthDurationMs(now); // July = 31 days
    // 1-hour window costing $1 means rate $1/hour.
    const forecast = forecastThisMonth(
      1,
      '2026-07-01T00:00:00.000Z',
      '2026-07-01T01:00:00.000Z',
      now,
    );
    expect(forecast).toBeCloseTo(monthMs / (60 * 60 * 1000));
  });

  it('falls back to the raw total for a non-positive window', () => {
    const now = new Date('2026-07-15T00:00:00.000Z');
    expect(
      forecastThisMonth(
        42,
        '2026-07-01T00:00:00Z',
        '2026-07-01T00:00:00Z',
        now,
      ),
    ).toBe(42);
  });
});

describe('aggregateRows', () => {
  it('aggregates across environments and cost-weights efficiency', () => {
    // Same project "gcp" seen in two environments; efficiency should be
    // weighted by spend: (0.3*22 + 0.7*6) / 28.
    const current = [
      costItem({
        project: 'gcp',
        cpuCost: 10,
        memoryCost: 12,
        efficiency: 0.3,
      }),
      costItem({
        project: 'gcp',
        environment: 'prod',
        cpuCost: 2,
        memoryCost: 4,
        efficiency: 0.7,
      }),
      costItem({ project: 'shop', cpuCost: 1, memoryCost: 1, efficiency: 0.5 }),
    ];
    const previous = [
      costItem({ project: 'gcp', cpuCost: 10, memoryCost: 10 }), // prev total 20
    ];

    const rows = aggregateRows(current, previous, 'namespace');
    const gcp = rows.find(r => r.key === 'gcp')!;
    expect(gcp.total).toBe(28);
    expect(gcp.cpuCost).toBe(12);
    expect(gcp.memoryCost).toBe(16);
    expect(gcp.efficiency).toBeCloseTo((0.3 * 22 + 0.7 * 6) / 28);
    expect(gcp.deltaPct).toBeCloseTo(((28 - 20) / 20) * 100);

    const shop = rows.find(r => r.key === 'shop')!;
    expect(shop.deltaPct).toBeNull(); // no previous data for shop

    // Sorted by total descending.
    expect(rows.map(r => r.key)).toEqual(['gcp', 'shop']);
  });

  it('attaches recommendations at the component level keyed by environment', () => {
    const current = [
      costItem({
        environment: 'dev',
        cpuCost: 2,
        memoryCost: 3,
        efficiency: 0.6,
      }),
    ];
    const recommendations: CostRecommendationItem[] = [
      {
        component: 'comp',
        environment: 'dev',
        project: 'proj',
        namespace: 'default',
        current: { cpuCost: 2, memoryCost: 3 },
        recommendation: {
          cpuRequest: '100m',
          memoryRequest: '128Mi',
          cpuCost: 1,
          memoryCost: 1,
        },
      },
    ];

    const rows = aggregateRows(current, [], 'component', recommendations);
    const dev = rows.find(r => r.key === 'dev')!;
    expect(dev.recommendation).toBeDefined();
    expect(dev.recommendation!.total).toBe(2);
    expect(dev.recommendation!.cpuRequest).toBe('100m');
  });
});

describe('computeSummary', () => {
  it('produces total, delta and efficiency', () => {
    const now = new Date('2026-07-15T00:00:00.000Z');
    const current = [
      costItem({ cpuCost: 10, memoryCost: 12, efficiency: 0.3 }),
    ];
    const previous = [costItem({ cpuCost: 10, memoryCost: 10 })];
    const summary = computeSummary(
      current,
      previous,
      '2026-07-01T00:00:00.000Z',
      '2026-07-01T01:00:00.000Z',
      now,
      [],
      'namespace',
      new Map(),
    );
    expect(summary.totalCost).toBe(22);
    expect(summary.deltaPct).toBeCloseTo(((22 - 20) / 20) * 100);
    expect(summary.efficiency).toBeCloseTo(0.3);
    expect(summary.forecastThisMonth).toBeGreaterThan(0);
    expect(summary.totalSaving).toBe(0);
  });

  it('counts saving only for dimensions that have a recommendation', () => {
    const now = new Date('2026-07-15T00:00:00.000Z');
    const current = [
      costItem({ project: 'gcp', cpuCost: 10, memoryCost: 12 }), // total 22
      costItem({ project: 'shop', cpuCost: 4, memoryCost: 4 }), // no rec
    ];
    const recommendations: CostRecommendationItem[] = [
      {
        component: 'comp',
        environment: 'dev',
        project: 'gcp',
        namespace: 'default',
        current: { cpuCost: 22, memoryCost: 0 },
        recommendation: { cpuCost: 6, memoryCost: 6 }, // gcp rec total 12
      },
    ];
    const summary = computeSummary(
      current,
      [],
      '2026-07-01T00:00:00.000Z',
      '2026-07-01T01:00:00.000Z',
      now,
      recommendations,
      'namespace',
      new Map(),
    );
    // Only gcp's own cost is reclaimable (22 - 12); shop's spend is untouched.
    expect(summary.totalSaving).toBeCloseTo(22 - 12);
  });

  it('credits saving from a zero-cost recommendation', () => {
    const now = new Date('2026-07-15T00:00:00.000Z');
    const current = [costItem({ project: 'gcp', cpuCost: 5, memoryCost: 0 })];
    const recommendations: CostRecommendationItem[] = [
      {
        component: 'comp',
        environment: 'dev',
        project: 'gcp',
        namespace: 'default',
        current: { cpuCost: 5, memoryCost: 0 },
        recommendation: { cpuCost: 0, memoryCost: 0 }, // reclaim everything
      },
    ];
    const summary = computeSummary(
      current,
      [],
      '2026-07-01T00:00:00.000Z',
      '2026-07-01T01:00:00.000Z',
      now,
      recommendations,
      'namespace',
      new Map(),
    );
    expect(summary.totalSaving).toBeCloseTo(5);
  });

  it('excludes stale environments from claimed saving', () => {
    const now = new Date('2026-07-15T00:00:00.000Z');
    const current = [
      costItem({ environment: 'dev', cpuCost: 8, memoryCost: 0 }),
    ];
    const recommendations: CostRecommendationItem[] = [
      {
        component: 'comp',
        environment: 'dev',
        project: 'proj',
        namespace: 'default',
        current: { cpuCost: 8, memoryCost: 0 },
        recommendation: { cpuCost: 2, memoryCost: 0 },
      },
    ];
    const summary = computeSummary(
      current,
      [],
      '2026-07-01T00:00:00.000Z',
      '2026-07-01T01:00:00.000Z',
      now,
      recommendations,
      'component',
      new Map([['dev', '2026-07-01T00:00:00.000Z']]),
    );
    expect(summary.totalSaving).toBe(0);
  });
});

describe('aggregateRows saving', () => {
  it('sets a per-row saving from the recommended dimension total', () => {
    const current = [costItem({ project: 'gcp', cpuCost: 10, memoryCost: 12 })];
    const recommendations: CostRecommendationItem[] = [
      {
        component: 'comp',
        environment: 'dev',
        project: 'gcp',
        namespace: 'default',
        current: { cpuCost: 22, memoryCost: 0 },
        recommendation: { cpuCost: 5, memoryCost: 5 }, // rec total 10
      },
    ];
    const rows = aggregateRows(current, [], 'namespace', recommendations);
    const gcp = rows.find(r => r.key === 'gcp')!;
    expect(gcp.saving).toBe(22 - 10);
  });

  it('leaves saving undefined when no recommendation covers the row', () => {
    const rows = aggregateRows(
      [costItem({ project: 'gcp', cpuCost: 1, memoryCost: 1 })],
      [],
      'namespace',
    );
    expect(rows[0].saving).toBeUndefined();
  });
});

describe('buildForecast', () => {
  const now = new Date('2026-07-15T00:00:00.000Z');

  it('forks the actual line into the two month-end projections', () => {
    const forecast = buildForecast({
      totalActual: 24,
      totalSaving: 6,
      windowStart: '2026-07-08T00:00:00.000Z',
      windowEnd: '2026-07-09T00:00:00.000Z', // 1-day window, $24 -> $1/hour
      now,
    })!;
    expect(forecast).not.toBeNull();
    // $1/h over the 31-day month.
    expect(forecast.atCurrentTotal).toBeCloseTo(24 * 31);
    expect(forecast.ifAppliedTotal).toBeLessThan(forecast.atCurrentTotal);
    expect(forecast.leftOnTable).toBeCloseTo(
      forecast.atCurrentTotal - forecast.ifAppliedTotal,
    );
    const fork = forecast.points.find(p => p.actual !== undefined);
    expect(fork?.atCurrent).toBe(fork?.ifApplied);
  });

  it('returns null for a non-positive window', () => {
    expect(
      buildForecast({
        totalActual: 10,
        totalSaving: 0,
        windowStart: '2026-07-09T00:00:00.000Z',
        windowEnd: '2026-07-09T00:00:00.000Z',
        now,
      }),
    ).toBeNull();
  });

  it('returns null when the window ends past the month end', () => {
    expect(
      buildForecast({
        totalActual: 10,
        totalSaving: 0,
        windowStart: '2026-07-30T00:00:00.000Z',
        windowEnd: '2026-08-05T00:00:00.000Z',
        now,
      }),
    ).toBeNull();
  });

  it('excludes prior-month spend when the window crosses the month boundary', () => {
    // 3-day window (72h) spanning Jun 29 -> Jul 2 at $1/hour; only the 24h in
    // July should count toward this month's cumulative fork.
    const forecast = buildForecast({
      totalActual: 72,
      totalSaving: 0,
      windowStart: '2026-06-29T00:00:00.000Z',
      windowEnd: '2026-07-02T00:00:00.000Z',
      now,
    })!;
    expect(forecast).not.toBeNull();
    const fork = forecast.points.find(
      p => p.actual !== undefined && p.atCurrent !== undefined,
    );
    expect(fork?.actual).toBeCloseTo(24); // not 72
    expect(forecast.atCurrentTotal).toBeCloseTo(31 * 24); // $1/h * 31 days
  });
});

describe('buildSeries', () => {
  it('buckets by time and stacks by dimension across environments', () => {
    const items = [
      costItem({
        startTime: '2026-07-01T00:00:00.000Z',
        project: 'gcp',
        cpuCost: 5,
        memoryCost: 5,
      }),
      costItem({
        startTime: '2026-07-01T00:00:00.000Z',
        project: 'shop',
        cpuCost: 1,
        memoryCost: 1,
      }),
      costItem({
        startTime: '2026-07-02T00:00:00.000Z',
        project: 'gcp',
        cpuCost: 3,
        memoryCost: 3,
      }),
    ];
    const { series, seriesKeys } = buildSeries(items, 'namespace');
    expect(seriesKeys).toEqual(['gcp', 'shop']);
    expect(series).toHaveLength(2);
    expect(series[0]).toMatchObject({
      timestamp: '2026-07-01T00:00:00.000Z',
      gcp: 10,
      shop: 2,
    });
    expect(series[1]).toMatchObject({
      timestamp: '2026-07-02T00:00:00.000Z',
      gcp: 6,
    });
  });
});

describe('buildCostInsightsData', () => {
  it('assembles the level, summary, rows and series into one payload', () => {
    const now = new Date('2026-07-15T00:00:00.000Z');
    const data = buildCostInsightsData({
      level: 'namespace',
      currentItems: [
        costItem({
          project: 'gcp',
          cpuCost: 10,
          memoryCost: 12,
          efficiency: 0.3,
        }),
        costItem({
          project: 'shop',
          cpuCost: 2,
          memoryCost: 4,
          efficiency: 0.7,
        }),
      ],
      previousItems: [
        costItem({ project: 'gcp', cpuCost: 10, memoryCost: 10 }),
      ],
      windowStart: '2026-07-01T00:00:00.000Z',
      windowEnd: '2026-07-01T01:00:00.000Z',
      now,
    });

    expect(data.level).toBe('namespace');
    expect(data.summary.totalCost).toBe(28);
    expect(data.rows.map(r => r.key)).toEqual(['gcp', 'shop']);
    expect(data.seriesKeys).toEqual(['gcp', 'shop']);
    expect(data.series).toHaveLength(1);
  });
});
