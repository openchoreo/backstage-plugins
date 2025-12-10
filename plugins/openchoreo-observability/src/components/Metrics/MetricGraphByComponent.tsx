import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LegendPayload,
} from 'recharts';
import { DataKey } from 'recharts/types/util/types';
import {
  CpuUsageMetrics,
  MemoryUsageMetrics,
  NetworkLatencyMetrics,
  NetworkThroughputMetrics,
} from '../../types';
import {
  formatAxisTime,
  formatTooltipTime,
  formatMetricValue,
  calculateTimeDomain,
  transformMetricsData,
  getMetricConfigs,
  getLineOpacity,
  formatMetricName,
} from './utils';
import { useMetricGraphStyles } from './styles';

export const MetricGraphByComponent = ({
  usageData,
  usageType,
  timeRange,
}: {
  usageData:
    | CpuUsageMetrics
    | MemoryUsageMetrics
    | NetworkThroughputMetrics
    | NetworkLatencyMetrics;
  usageType: 'cpu' | 'memory' | 'networkThroughput' | 'networkLatency';
  timeRange?: string;
}) => {
  const classes = useMetricGraphStyles();
  const [hoveringDataKey, setHoveringDataKey] = useState<
    DataKey<any> | undefined
  >();

  const transformedData = useMemo(
    () => transformMetricsData(usageData),
    [usageData],
  );

  const { ticks, daysRange, domain } = useMemo(
    () => calculateTimeDomain(transformedData, timeRange),
    [transformedData, timeRange],
  );

  const metrics = useMemo(() => getMetricConfigs(usageType), [usageType]);

  const handleMouseEnter = (payload: LegendPayload) =>
    setHoveringDataKey(payload.dataKey);

  const handleMouseLeave = () => setHoveringDataKey(undefined);

  if (transformedData.length === 0) {
    return (
      <div className={classes.chartContainer}>
        <div className={classes.emptyChart}>No data available</div>
        {(usageType === 'networkThroughput' ||
          usageType === 'networkLatency') && (
          <p className={classes.emptyChartText}>
            Network metrics are available in OpenChoreo Cilium Edition only.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={classes.chartContainer}>
      <LineChart
        className={classes.lineChart}
        responsive
        data={transformedData}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="timestamp"
          type="number"
          domain={domain}
          tickFormatter={ts => formatAxisTime(ts, daysRange)}
          ticks={ticks}
          tick={{ fontSize: 12 }}
        />
        <YAxis
          width="auto"
          tickFormatter={v => formatMetricValue(v, usageType)}
        />
        <Tooltip
          labelFormatter={formatTooltipTime}
          formatter={(value: number) => formatMetricValue(value, usageType)}
        />
        <Legend
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
        {Object.entries(metrics).map(([, { key, color }]) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            name={formatMetricName(key)}
            strokeOpacity={getLineOpacity(key, hoveringDataKey)}
            stroke={color}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </div>
  );
};
