import type { CostItem, CostRecommendationItem } from '../../types';
import {
  deriveLevel,
  dimensionOf,
  totalCost,
  percentChange,
  monthDurationMs,
  forecastThisMonth,
  aggregateRows,
  computeSummary,
  buildSeries,
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
    );
    expect(summary.totalCost).toBe(22);
    expect(summary.deltaPct).toBeCloseTo(((22 - 20) / 20) * 100);
    expect(summary.efficiency).toBeCloseTo(0.3);
    expect(summary.forecastThisMonth).toBeGreaterThan(0);
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
