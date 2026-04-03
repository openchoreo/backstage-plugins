import {
  formatAxisTime,
  formatMetricValue,
  parseTimeRange,
  transformMetricsData,
  getMetricConfigs,
  getLineOpacity,
  formatMetricName,
} from './utils';

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

  it('formats memory in MB', () => {
    expect(formatMetricValue(5000000, 'memory')).toBe('5.00 MB');
  });

  it('formats memory in KB', () => {
    expect(formatMetricValue(5000, 'memory')).toBe('5.00 KB');
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
      cpuRequests: [
        { timestamp: '2024-06-01T10:00:00Z', value: 0.25 },
      ],
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
