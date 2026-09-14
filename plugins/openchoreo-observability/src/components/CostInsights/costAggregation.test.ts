import type { CostItem, CostRecommendationItem } from '../../types';
import {
  deriveLevel,
  expandSelection,
  dimensionOf,
  totalCost,
  percentChange,
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
    const current = [
      costItem({ cpuCost: 10, memoryCost: 12, efficiency: 0.3 }),
    ];
    const previous = [costItem({ cpuCost: 10, memoryCost: 10 })];
    const summary = computeSummary(
      current,
      previous,
      [],
      'namespace',
      new Map(),
    );
    expect(summary.totalCost).toBe(22);
    expect(summary.deltaPct).toBeCloseTo(((22 - 20) / 20) * 100);
    expect(summary.efficiency).toBeCloseTo(0.3);
    expect(summary.totalSaving).toBe(0);
  });

  it('counts saving only for dimensions that have a recommendation', () => {
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
      recommendations,
      'namespace',
      new Map(),
    );
    // Only gcp's own cost is reclaimable (22 - 12); shop's spend is untouched.
    expect(summary.totalSaving).toBeCloseTo(22 - 12);
  });

  it('credits saving from a zero-cost recommendation', () => {
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
      recommendations,
      'namespace',
      new Map(),
    );
    expect(summary.totalSaving).toBeCloseTo(5);
  });

  it('excludes stale environments from claimed saving', () => {
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
  // Use local Date constructors so the internally-computed month boundaries line
  // up with the inputs regardless of the test runner's timezone.
  const now = new Date(2026, 6, 15); // Jul 15
  const monthStart = new Date(2026, 6, 1); // Jul 1
  // Daily buckets Jul 1..Jul 14, $24 each -> $336 month-to-date.
  const mtdItems = Array.from({ length: 14 }, (_, i) =>
    costItem({
      startTime: new Date(2026, 6, i + 1).toISOString(),
      cpuCost: 12,
      memoryCost: 12,
    }),
  );

  it('accumulates the actual curve and forks into two month-end projections', () => {
    const forecast = buildForecast({
      mtdItems,
      savingFraction: 0.25,
      monthStart,
      now,
    })!;
    expect(forecast).not.toBeNull();
    // The actual curve starts at zero on the month start.
    expect(forecast.points[0]).toMatchObject({ actual: 0 });
    // Fork at "now" carries the month-to-date total on all three series.
    const fork = forecast.points.find(
      p => p.actual !== undefined && p.forecast !== undefined,
    );
    expect(fork?.actual).toBeCloseTo(336);
    expect(fork?.forecast).toBe(fork?.actual);
    expect(fork?.ifApplied).toBe(fork?.actual);
    // Extrapolated to the full ~31-day month at the same $24/day rate.
    expect(forecast.atCurrentTotal).toBeCloseTo(744, 0);
    // Recommendations cut only the remaining spend, so it lands between the
    // month-to-date total and the at-current projection.
    expect(forecast.ifAppliedTotal).toBeLessThan(forecast.atCurrentTotal);
    expect(forecast.ifAppliedTotal).toBeGreaterThan(336);
    expect(forecast.leftOnTable).toBeCloseTo(
      forecast.atCurrentTotal - forecast.ifAppliedTotal,
    );
  });

  it('returns null before any time has elapsed this month', () => {
    expect(
      buildForecast({
        mtdItems: [],
        savingFraction: 0,
        monthStart,
        now: monthStart,
      }),
    ).toBeNull();
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
    const now = new Date(2026, 6, 15);
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
      monthStart: new Date(2026, 6, 1),
      now,
    });

    expect(data.level).toBe('namespace');
    expect(data.summary.totalCost).toBe(28);
    expect(data.rows.map(r => r.key)).toEqual(['gcp', 'shop']);
    expect(data.seriesKeys).toEqual(['gcp', 'shop']);
    expect(data.series).toHaveLength(1);
  });
});
