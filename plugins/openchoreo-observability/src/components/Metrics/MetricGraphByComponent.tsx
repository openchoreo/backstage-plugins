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
import { CpuUsageMetrics, MemoryUsageMetrics } from '../../types';
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

export const MetricGraphByComponent = ({
  usageData,
  usageType,
  timeRange,
}: {
  usageData: CpuUsageMetrics | MemoryUsageMetrics;
  usageType: 'cpu' | 'memory';
  timeRange?: string;
}) => {
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

  return (
    <div style={{ width: '100%' }}>
      <LineChart
        style={{
          width: '100%',
          maxWidth: '100%',
          maxHeight: '70vh',
          aspectRatio: 1.618,
        }}
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
        <Tooltip labelFormatter={formatTooltipTime} />
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
