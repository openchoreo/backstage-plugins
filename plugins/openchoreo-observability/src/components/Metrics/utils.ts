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
    // value is in Bytes; Kubernetes memory uses IEC binary units
    if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GiB`;
    if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(2)} MiB`;
    if (value >= 1024) return `${(value / 1024).toFixed(2)} KiB`;
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
 * Round x up to the next "nice" number (1, 2, 5 × 10^n).
 */
const niceCeil = (x: number): number => {
  if (x <= 0) return 1;
  const exp = Math.floor(Math.log10(x));
  const pow = 10 ** exp;
  const f = x / pow;
  let nf: number;
  if (f <= 1) nf = 1;
  else if (f <= 2) nf = 2;
  else if (f <= 5) nf = 5;
  else nf = 10;
  return nf * pow;
};

/**
 * Compute Y-axis ticks (in bytes) that render as round numbers in the
 * display unit (KiB/MiB/GiB). Returns undefined when the data has no
 * positive values, so the caller can fall back to Recharts defaults.
 */
export const calculateMemoryYAxis = (
  usageData: MemoryUsageMetrics,
): { ticks: number[]; domain: [number, number] } | undefined => {
  let max = 0;
  Object.values(usageData).forEach(series => {
    series.forEach(point => {
      const v = point.value;
      if (typeof v === 'number' && v > max) max = v;
    });
  });
  if (max <= 0) return undefined;

  const B = 1;
  const KiB = 1024;
  const MiB = KiB * 1024;
  const GiB = MiB * 1024;
  let unit: number;
  if (max >= GiB) unit = GiB;
  else if (max >= MiB) unit = MiB;
  else if (max >= KiB) unit = KiB;
  else unit = B;

  const maxInUnit = max / unit;
  const niceStep = niceCeil(maxInUnit / 4);
  const finalMaxInUnit = Math.ceil(maxInUnit / niceStep) * niceStep;
  const numTicks = Math.round(finalMaxInUnit / niceStep) + 1;
  const ticks = Array.from({ length: numTicks }, (_, i) => i * niceStep * unit);
  return { ticks, domain: [0, finalMaxInUnit * unit] };
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
 * Calculate time domain and ticks for the chart.
 * If `customRange` is provided (used for `timeRange === 'custom'`), it takes
 * precedence over the preset duration so the axis matches the user's window.
 */
export const calculateTimeDomain = (
  transformedData: Array<{ timestamp: number }>,
  timeRange?: string,
  tickCount: number = 5,
  customRange?: { startTime?: string; endTime?: string },
) => {
  let minTimestamp: number;
  let maxTimestamp: number;

  const customStartMs = customRange?.startTime
    ? new Date(customRange.startTime).getTime()
    : NaN;
  const customEndMs = customRange?.endTime
    ? new Date(customRange.endTime).getTime()
    : NaN;
  const hasCustomRange =
    timeRange === 'custom' &&
    Number.isFinite(customStartMs) &&
    Number.isFinite(customEndMs) &&
    customEndMs > customStartMs;

  const duration = parseTimeRange(timeRange);

  if (hasCustomRange) {
    minTimestamp = customStartMs;
    maxTimestamp = customEndMs;
  } else if (duration) {
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

type RawPoint = { timestamp: string; value: number | null };
type MetricDataPoint = { timestamp: number; [key: string]: any };

const injectPerMetricGaps = (
  usageData: Record<string, RawPoint[]>,
): Record<string, RawPoint[]> => {
  const result: Record<string, RawPoint[]> = {};

  Object.entries(usageData).forEach(([metricName, points]) => {
    const sortedPoints = [...points].sort((a, b) => {
      const aEpoch = new Date(a.timestamp).getTime();
      const bEpoch = new Date(b.timestamp).getTime();
      return aEpoch - bEpoch;
    });

    if (sortedPoints.length < 2) {
      result[metricName] = sortedPoints;
      return;
    }

    const epochs = sortedPoints.map(p => new Date(p.timestamp).getTime());
    const intervals = epochs.slice(1).map((t, i) => t - epochs[i]);
    const sortedIntervals = [...intervals].sort((a, b) => a - b);
    const medianInterval =
      sortedIntervals[Math.floor(sortedIntervals.length / 2)];
    const gapThreshold = medianInterval * 2;

    const injected: RawPoint[] = [];
    for (let i = 0; i < sortedPoints.length; i++) {
      injected.push(sortedPoints[i]);
      if (
        i < sortedPoints.length - 1 &&
        epochs[i + 1] - epochs[i] > gapThreshold
      ) {
        // Sentinel key: numeric ms string, distinct from ISO timestamp keys
        const sentinelEpoch = epochs[i] + medianInterval;
        injected.push({ timestamp: String(sentinelEpoch), value: null });
      }
    }
    result[metricName] = injected;
  });

  return result;
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
  const gapped = injectPerMetricGaps(usageData as Record<string, RawPoint[]>);
  const timeMap = new Map<string, MetricDataPoint>();

  // Collect all unique timestamps and merge metric values
  Object.entries(gapped).forEach(([metricName, metricData]) => {
    metricData.forEach(point => {
      if (!timeMap.has(point.timestamp)) {
        const epochMs = isNaN(Number(point.timestamp))
          ? new Date(point.timestamp).getTime()
          : Number(point.timestamp);
        timeMap.set(point.timestamp, {
          time: point.timestamp,
          timestamp: epochMs,
        });
      }
      timeMap.get(point.timestamp)![metricName] = point.value;
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
        key: 'latencyP50',
        color: '#82ca9d',
      },
      p90Latency: {
        key: 'latencyP90',
        color: '#ffc658',
      },
      p99Latency: {
        key: 'latencyP99',
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
