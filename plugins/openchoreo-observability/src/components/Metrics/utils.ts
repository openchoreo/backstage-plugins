import { DataKey } from 'recharts/types/util/types';
import {
  CpuUsageMetrics,
  MemoryUsageMetrics,
  NetworkLatencyMetrics,
  NetworkThroughputMetrics,
} from '../../types';

/**
 * Format timestamp for axis display based on the time range
 */
export const formatAxisTime = (
  timestamp: number,
  daysRange: number,
): string => {
  const date = new Date(timestamp);

  if (daysRange > 1) {
    // For ranges > 1 day, show date in yyyy/mm/dd format
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  }

  // For <= 1 day, show time in HH:MM:SS format
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

/**
 * Format tooltip label with full date and time
 */
export const formatTooltipTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

/**
 * Format metric value based on usage type
 */
export const formatMetricValue = (
  value: number,
  usageType: 'cpu' | 'memory' | 'networkThroughput' | 'networkLatency',
): string => {
  if (value === 0) return '0';

  if (usageType === 'cpu') {
    // value is in CPU cores
    if (value > 1) return `${value.toFixed(4)}`;
    if (value > 0.001) return `${(value * 1000).toFixed(2)} mCPU`;
    return `${(value * 1000000).toFixed(2)} uCPU`;
  }
  if (usageType === 'memory') {
    // value is in Bytes
    if (value > 1000000) return `${(value / 1000000).toFixed(2)} MB`;
    if (value > 1000) return `${(value / 1000).toFixed(2)} KB`;
    return `${value.toFixed(2)} B`;
  }
  if (usageType === 'networkThroughput') {
    return `${value.toFixed(2)} req/s`;
  }
  if (usageType === 'networkLatency') {
    // value is in seconds
    if (value > 1) return `${value.toFixed(2)} s`;
    if (value > 0.001) return `${(value * 1000).toFixed(2)} ms`;
    return `${(value * 1000000).toFixed(2)} us`;
  }
  return value.toFixed(2);
};

/**
 * Parse time range string (e.g., "14d", "1h", "30m") to milliseconds
 */
export const parseTimeRange = (range?: string): number | null => {
  if (!range) return null;

  const value = parseInt(range.slice(0, -1), 10);
  const unit = range.slice(-1);

  switch (unit) {
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
};

/**
 * Calculate time domain and ticks for the chart
 */
export const calculateTimeDomain = (
  transformedData: Array<{ timestamp: number }>,
  timeRange?: string,
  tickCount: number = 5,
) => {
  const duration = parseTimeRange(timeRange);

  let minTimestamp: number;
  let maxTimestamp: number;

  if (duration) {
    // Use selected range
    const now = Date.now();
    minTimestamp = now - duration;
    maxTimestamp = now;
  } else if (transformedData.length > 0) {
    // Fall back to data range
    minTimestamp = transformedData[0].timestamp;
    maxTimestamp = transformedData[transformedData.length - 1].timestamp;
  } else {
    return { ticks: [], daysRange: 0, domain: [0, 1] as [number, number] };
  }

  const timeRangeDuration = maxTimestamp - minTimestamp;
  const daysRange = timeRangeDuration / (1000 * 60 * 60 * 24);
  const tickInterval = timeRangeDuration / (tickCount - 1);

  const ticks = Array.from(
    { length: tickCount },
    (_, i) => minTimestamp + i * tickInterval,
  );

  return {
    ticks,
    daysRange,
    domain: [minTimestamp, maxTimestamp] as [number, number],
  };
};

/**
 * Transform metrics data structure to be compatible with Recharts
 */
export const transformMetricsData = (
  usageData:
    | CpuUsageMetrics
    | MemoryUsageMetrics
    | NetworkThroughputMetrics
    | NetworkLatencyMetrics,
) => {
  const timeMap = new Map<string, any>();

  // Collect all unique timestamps and merge metric values
  Object.entries(usageData).forEach(([metricName, metricData]) => {
    metricData.forEach((point: any) => {
      if (!timeMap.has(point.time)) {
        timeMap.set(point.time, {
          time: point.time,
          timestamp: new Date(point.time).getTime(),
        });
      }
      timeMap.get(point.time)[metricName] = point.value;
    });
  });

  return Array.from(timeMap.values()).sort((a, b) => a.timestamp - b.timestamp);
};

/**
 * Metric configuration for CPU and Memory charts
 */
export interface MetricConfig {
  key: string;
  color: string;
}

export const getMetricConfigs = (
  usageType: 'cpu' | 'memory' | 'networkThroughput' | 'networkLatency',
): Record<string, MetricConfig> => {
  if (usageType === 'networkThroughput') {
    return {
      totalRequests: {
        key: 'requestCount',
        color: '#8884d8',
      },
      successfulRequests: {
        key: 'successfulRequestCount',
        color: '#82ca9d',
      },
      unsuccessfulRequests: {
        key: 'unsuccessfulRequestCount',
        color: '#ff7f7f',
      },
    };
  }

  if (usageType === 'networkLatency') {
    return {
      meanLatency: {
        key: 'meanLatency',
        color: '#8884d8',
      },
      p50Latency: {
        key: 'latencyPercentile50th',
        color: '#82ca9d',
      },
      p90Latency: {
        key: 'latencyPercentile90th',
        color: '#ffc658',
      },
      p99Latency: {
        key: 'latencyPercentile99th',
        color: '#ff7300',
      },
    };
  }

  if (usageType === 'cpu') {
    return {
      usage: {
        key: 'cpuUsage',
        color: '#8884d8',
      },
      requests: {
        key: 'cpuRequests',
        color: '#82ca9d',
      },
      limits: {
        key: 'cpuLimits',
        color: '#ffc658',
      },
    };
  }

  return {
    usage: {
      key: 'memoryUsage',
      color: '#8884d8',
    },
    requests: {
      key: 'memoryRequests',
      color: '#82ca9d',
    },
    limits: {
      key: 'memoryLimits',
      color: '#ffc658',
    },
  };
};

/**
 * Calculate opacity for metric lines based on hover state
 */
export const getLineOpacity = (
  metricKey: string,
  hoveringDataKey?: DataKey<any>,
): number => {
  return !hoveringDataKey || hoveringDataKey === metricKey ? 1 : 0.5;
};

/**
 * Format metric key to display name (e.g., 'cpuUsage' -> 'CPU Usage')
 */
export const formatMetricName = (key: string): string => {
  const name = key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase());
  if (name.includes('Cpu')) {
    // Capitalize to CPU
    return name.replace('Cpu', 'CPU');
  }
  return name;
};
