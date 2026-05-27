import {
  formatAxisTime,
  formatMetricValue,
  parseTimeRange,
  transformMetricsData,
  getMetricConfigs,
  getLineOpacity,
  formatMetricName,
  calculateTimeDomain,
  calculateMemoryYAxis,
} from './utils';
import { MemoryUsageMetrics } from '../../types';

const memoryData = (
  values: (number | null)[],
  key: keyof MemoryUsageMetrics = 'memoryUsage',
): MemoryUsageMetrics => ({
  memoryUsage: [],
  memoryRequests: [],
  memoryLimits: [],
  [key]: values.map((value, i) => ({
    timestamp: new Date(2024, 0, 1, 0, i).toISOString(),
    value,
  })),
});

// ---- Tests ----

describe('formatAxisTime', () => {
  it('shows time format for ranges <= 1 day', () => {
    const ts = new Date('2024-06-01T14:30:45Z').getTime();
    const result = formatAxisTime(ts, 0.5);

    // Should be in HH:MM:SS format (local time)
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('shows date format for ranges > 1 day', () => {
    const ts = new Date('2024-06-01T14:30:45Z').getTime();
    const result = formatAxisTime(ts, 7);

    // Should be in yyyy/mm/dd format
    expect(result).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
  });
});

describe('formatMetricValue', () => {
  it('returns "0" for zero value', () => {
    expect(formatMetricValue(0, 'cpu')).toBe('0');
  });

  it('formats CPU in mCPU for small values', () => {
    expect(formatMetricValue(0.05, 'cpu')).toBe('50.00 mCPU');
  });

  it('formats CPU in uCPU for very small values', () => {
    expect(formatMetricValue(0.0005, 'cpu')).toBe('500.00 uCPU');
  });

  it('formats CPU cores for values > 1', () => {
    expect(formatMetricValue(2.5, 'cpu')).toBe('2.5000');
  });

  it('formats memory in GiB', () => {
    expect(formatMetricValue(5000000000, 'memory')).toBe('4.66 GiB');
  });

  it('formats memory in MiB', () => {
    expect(formatMetricValue(5000000, 'memory')).toBe('4.77 MiB');
  });

  it('formats memory in KiB', () => {
    expect(formatMetricValue(5000, 'memory')).toBe('4.88 KiB');
  });

  it('formats memory in bytes', () => {
    expect(formatMetricValue(500, 'memory')).toBe('500.00 B');
  });

  it('formats network throughput', () => {
    expect(formatMetricValue(42.5, 'networkThroughput')).toBe('42.50 req/s');
  });

  it('formats network latency in seconds', () => {
    expect(formatMetricValue(2.5, 'networkLatency')).toBe('2.50 s');
  });

  it('formats network latency in ms', () => {
    expect(formatMetricValue(0.05, 'networkLatency')).toBe('50.00 ms');
  });

  it('formats network latency in us', () => {
    expect(formatMetricValue(0.0005, 'networkLatency')).toBe('500.00 us');
  });
});

describe('parseTimeRange', () => {
  it('parses minutes', () => {
    expect(parseTimeRange('10m')).toBe(10 * 60 * 1000);
  });

  it('parses hours', () => {
    expect(parseTimeRange('1h')).toBe(60 * 60 * 1000);
  });

  it('parses days', () => {
    expect(parseTimeRange('7d')).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('returns null for undefined', () => {
    expect(parseTimeRange(undefined)).toBeNull();
  });

  it('returns null for unknown unit', () => {
    expect(parseTimeRange('5x')).toBeNull();
  });
});

describe('transformMetricsData', () => {
  it('transforms metrics data into Recharts format', () => {
    const data = {
      cpuUsage: [
        { timestamp: '2024-06-01T10:00:00Z', value: 0.5 },
        { timestamp: '2024-06-01T10:01:00Z', value: 0.6 },
      ],
      cpuRequests: [{ timestamp: '2024-06-01T10:00:00Z', value: 0.25 }],
      cpuLimits: [],
    };

    const result = transformMetricsData(data);

    expect(result).toHaveLength(2);
    expect(result[0].cpuUsage).toBe(0.5);
    expect(result[0].cpuRequests).toBe(0.25);
    expect(result[1].cpuUsage).toBe(0.6);
  });

  it('returns empty array for empty metrics', () => {
    const result = transformMetricsData({} as any);

    expect(result).toEqual([]);
  });

  it('sorts by timestamp ascending', () => {
    const data = {
      cpuUsage: [
        { timestamp: '2024-06-01T10:02:00Z', value: 0.3 },
        { timestamp: '2024-06-01T10:00:00Z', value: 0.1 },
      ],
    };

    const result = transformMetricsData(data as any);

    expect(result[0].cpuUsage).toBe(0.1);
    expect(result[1].cpuUsage).toBe(0.3);
  });

  it('inserts a null entry for the metric that has a gap', () => {
    // cpuUsage has a 12-min gap; cpuLimits is continuous
    const data = {
      cpuUsage: [
        { timestamp: '2024-06-01T10:00:00Z', value: 0.1 },
        { timestamp: '2024-06-01T10:01:00Z', value: 0.2 },
        { timestamp: '2024-06-01T10:02:00Z', value: 0.3 },
        { timestamp: '2024-06-01T10:14:00Z', value: 0.4 },
        { timestamp: '2024-06-01T10:15:00Z', value: 0.5 },
      ],
      cpuLimits: [
        { timestamp: '2024-06-01T10:00:00Z', value: 1 },
        { timestamp: '2024-06-01T10:01:00Z', value: 1 },
        { timestamp: '2024-06-01T10:02:00Z', value: 1 },
        { timestamp: '2024-06-01T10:03:00Z', value: 1 },
        { timestamp: '2024-06-01T10:14:00Z', value: 1 },
        { timestamp: '2024-06-01T10:15:00Z', value: 1 },
      ],
    };

    const result = transformMetricsData(data as any);

    // A null sentinel for cpuUsage should exist
    const nullForUsage = result.find(d => d.cpuUsage === null);
    expect(nullForUsage).toBeDefined();

    // cpuLimits should not be nulled at the cpuUsage-gap sentinel
    expect(nullForUsage?.cpuLimits).toBeUndefined();
  });

  it('does not null a continuous metric when another metric has a gap', () => {
    const data = {
      cpuUsage: [
        { timestamp: '2024-06-01T10:00:00Z', value: 0.1 },
        { timestamp: '2024-06-01T10:01:00Z', value: 0.15 },
        { timestamp: '2024-06-01T10:02:00Z', value: 0.18 },
        { timestamp: '2024-06-01T10:12:00Z', value: 0.2 }, // 10-min gap
      ],
      cpuLimits: [
        { timestamp: '2024-06-01T10:00:00Z', value: 1 },
        { timestamp: '2024-06-01T10:01:00Z', value: 1 },
        { timestamp: '2024-06-01T10:02:00Z', value: 1 },
      ],
    };

    const result = transformMetricsData(data as any);
    expect(result.some(entry => entry.cpuUsage === null)).toBe(true);
    const cpuLimitTimestamps = new Set(
      data.cpuLimits.map(point => point.timestamp),
    );

    const cpuLimitValues = result
      .filter(d => cpuLimitTimestamps.has(d.time))
      .map(d => d.cpuLimits);

    expect(cpuLimitValues.every(value => value !== null)).toBe(true);
  });

  it('does not insert nulls when data is evenly spaced', () => {
    const data = {
      cpuUsage: [
        { timestamp: '2024-06-01T10:00:00Z', value: 0.1 },
        { timestamp: '2024-06-01T10:01:00Z', value: 0.2 },
        { timestamp: '2024-06-01T10:02:00Z', value: 0.3 },
      ],
    };

    const result = transformMetricsData(data as any);

    expect(result).toHaveLength(3);
    expect(result.every(d => d.cpuUsage !== null)).toBe(true);
  });
});

describe('getMetricConfigs', () => {
  it('returns CPU metric configs', () => {
    const configs = getMetricConfigs('cpu');

    expect(configs.usage.key).toBe('cpuUsage');
    expect(configs.requests.key).toBe('cpuRequests');
    expect(configs.limits.key).toBe('cpuLimits');
  });

  it('returns memory metric configs', () => {
    const configs = getMetricConfigs('memory');

    expect(configs.usage.key).toBe('memoryUsage');
    expect(configs.requests.key).toBe('memoryRequests');
    expect(configs.limits.key).toBe('memoryLimits');
  });

  it('returns network throughput configs', () => {
    const configs = getMetricConfigs('networkThroughput');

    expect(configs.totalRequests.key).toBe('requestCount');
    expect(configs.successfulRequests.key).toBe('successfulRequestCount');
    expect(configs.unsuccessfulRequests.key).toBe('unsuccessfulRequestCount');
  });

  it('returns network latency configs', () => {
    const configs = getMetricConfigs('networkLatency');

    expect(configs.meanLatency.key).toBe('meanLatency');
    expect(configs.p50Latency.key).toBe('latencyP50');
    expect(configs.p90Latency.key).toBe('latencyP90');
    expect(configs.p99Latency.key).toBe('latencyP99');
  });
});

describe('getLineOpacity', () => {
  it('returns 1 when no key is hovered', () => {
    expect(getLineOpacity('cpuUsage')).toBe(1);
  });

  it('returns 1 when the hovered key matches', () => {
    expect(getLineOpacity('cpuUsage', 'cpuUsage')).toBe(1);
  });

  it('returns 0.5 when a different key is hovered', () => {
    expect(getLineOpacity('cpuUsage', 'cpuRequests')).toBe(0.5);
  });
});

describe('calculateTimeDomain', () => {
  const NOW = new Date('2026-05-11T12:00:00Z').getTime();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns 5 evenly spaced ticks for a preset range', () => {
    const { ticks, domain, daysRange } = calculateTimeDomain([], '1h');

    expect(ticks).toHaveLength(5);
    expect(domain).toEqual([NOW - 60 * 60 * 1000, NOW]);
    expect(daysRange).toBeCloseTo(1 / 24);
    // ticks evenly spaced
    expect(ticks[1] - ticks[0]).toBe(ticks[2] - ticks[1]);
  });

  it('honors customRange when timeRange is custom', () => {
    const startTime = '2026-05-04T08:00:00.000Z';
    const endTime = '2026-05-06T08:00:00.000Z';

    const { domain, daysRange } = calculateTimeDomain([], 'custom', 5, {
      startTime,
      endTime,
    });

    expect(domain).toEqual([
      new Date(startTime).getTime(),
      new Date(endTime).getTime(),
    ]);
    expect(daysRange).toBe(2);
  });

  it('falls back to the preset when customRange is incomplete', () => {
    const { domain } = calculateTimeDomain([], 'custom', 5, {
      startTime: '2026-05-04T08:00:00.000Z',
    });

    // Falls through to the parseTimeRange path; 'custom' is not parseable so
    // the empty-data branch returns the [0, 1] fallback domain.
    expect(domain).toEqual([0, 1]);
  });

  it('falls back to the preset when customRange end is before start', () => {
    const { domain } = calculateTimeDomain([], 'custom', 5, {
      startTime: '2026-05-06T08:00:00.000Z',
      endTime: '2026-05-04T08:00:00.000Z',
    });

    expect(domain).toEqual([0, 1]);
  });

  it('falls back to data range when timeRange is missing and data is present', () => {
    const data = [
      { timestamp: 1_000 },
      { timestamp: 2_000 },
      { timestamp: 3_000 },
    ];
    const { domain } = calculateTimeDomain(data);
    expect(domain).toEqual([1_000, 3_000]);
  });

  it('returns the empty fallback when no range and no data are available', () => {
    expect(calculateTimeDomain([])).toEqual({
      ticks: [],
      daysRange: 0,
      domain: [0, 1],
    });
  });

  it('respects the tickCount argument', () => {
    const { ticks } = calculateTimeDomain([], '1h', 3);
    expect(ticks).toHaveLength(3);
  });
});

describe('formatMetricName', () => {
  it('formats camelCase to title case', () => {
    expect(formatMetricName('memoryUsage')).toBe('Memory Usage');
  });

  it('capitalizes CPU properly', () => {
    expect(formatMetricName('cpuUsage')).toBe('CPU Usage');
  });

  it('formats cpuRequests', () => {
    expect(formatMetricName('cpuRequests')).toBe('CPU Requests');
  });

  it('formats latencyP99', () => {
    expect(formatMetricName('latencyP99')).toBe('Latency P99');
  });
});

describe('calculateMemoryYAxis', () => {
  const KiB = 1024;
  const MiB = KiB * 1024;
  const GiB = MiB * 1024;

  it('returns undefined when all series are empty', () => {
    expect(calculateMemoryYAxis(memoryData([]))).toBeUndefined();
  });

  it('returns undefined when all values are null', () => {
    expect(calculateMemoryYAxis(memoryData([null, null]))).toBeUndefined();
  });

  it('returns undefined when max is 0', () => {
    expect(calculateMemoryYAxis(memoryData([0, 0]))).toBeUndefined();
  });

  it('picks MiB unit with nice round ticks for pod-scale data', () => {
    // max ≈ 267 MiB → niceStep = 100 MiB, finalMax = 300 MiB, 4 ticks
    const result = calculateMemoryYAxis(memoryData([267 * MiB]));

    expect(result).toEqual({
      ticks: [0, 100 * MiB, 200 * MiB, 300 * MiB],
      domain: [0, 300 * MiB],
    });
  });

  it('picks GiB unit for large pods', () => {
    // max = 3 GiB → niceStep = 1 GiB, finalMax = 3 GiB, 4 ticks
    const result = calculateMemoryYAxis(memoryData([3 * GiB]));

    expect(result).toEqual({
      ticks: [0, GiB, 2 * GiB, 3 * GiB],
      domain: [0, 3 * GiB],
    });
  });

  it('picks KiB unit for small data', () => {
    // max = 5 KiB → niceStep = 2 KiB, finalMax = 6 KiB, 4 ticks
    const result = calculateMemoryYAxis(memoryData([5 * KiB]));

    expect(result).toEqual({
      ticks: [0, 2 * KiB, 4 * KiB, 6 * KiB],
      domain: [0, 6 * KiB],
    });
  });

  it('picks bytes unit for sub-KiB data so ticks stay whole bytes', () => {
    // max = 500 B → niceStep = 200 B, finalMax = 600 B, 4 ticks
    const result = calculateMemoryYAxis(memoryData([500]));

    expect(result).toEqual({
      ticks: [0, 200, 400, 600],
      domain: [0, 600],
    });
  });

  it('takes the max across all series', () => {
    const data: MemoryUsageMetrics = {
      memoryUsage: [{ timestamp: 't1', value: 50 * MiB }],
      memoryRequests: [{ timestamp: 't1', value: 100 * MiB }],
      memoryLimits: [{ timestamp: 't1', value: 200 * MiB }],
    };
    const result = calculateMemoryYAxis(data);

    // max is 200 MiB → niceStep = 50, finalMax = 200, 5 ticks
    expect(result?.ticks[result.ticks.length - 1]).toBe(200 * MiB);
    expect(result?.domain[1]).toBe(200 * MiB);
  });

  it('produces ticks evenly spaced starting at 0', () => {
    const result = calculateMemoryYAxis(memoryData([150 * MiB]));

    expect(result?.ticks[0]).toBe(0);
    const step = result!.ticks[1] - result!.ticks[0];
    for (let i = 1; i < result!.ticks.length; i++) {
      expect(result!.ticks[i] - result!.ticks[i - 1]).toBe(step);
    }
  });

  it('domain max equals the last tick and is >= data max', () => {
    const dataMax = 137 * MiB;
    const result = calculateMemoryYAxis(memoryData([dataMax]));

    expect(result?.domain[1]).toBe(result?.ticks[result.ticks.length - 1]);
    expect(result!.domain[1]).toBeGreaterThanOrEqual(dataMax);
  });

  it('ignores null values when computing the max', () => {
    const result = calculateMemoryYAxis(
      memoryData([null, 100 * MiB, null, 50 * MiB]),
    );

    // Max is 100 MiB → niceStep = 25, finalMax = 100, 5 ticks
    expect(result?.domain[1]).toBe(100 * MiB);
  });
});
