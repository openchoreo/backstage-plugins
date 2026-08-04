import { useMemo } from 'react';
import { Card, CardContent, CardHeader, Typography } from '@material-ui/core';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DoraGranularity } from '../../types';
import { formatBucketLabel } from './utils';

const CHART_HEIGHT = 220;

export interface DoraChartSeries {
  /** Field in each data point to plot. */
  dataKey: string;
  label: string;
  color: string;
}

export interface DoraTrendChartProps {
  title: string;
  granularity: DoraGranularity;
  /** Points with a `bucketStart` ISO string plus the series' value fields. */
  data: Array<Record<string, string | number>>;
  series: DoraChartSeries[];
  /** bar = counts (deployment frequency); line = rates and durations. */
  variant: 'bar' | 'line';
  valueFormatter: (value: number) => string;
  emptyMessage?: string;
}

export const DoraTrendChart = ({
  title,
  granularity,
  data,
  series,
  variant,
  valueFormatter,
  emptyMessage,
}: DoraTrendChartProps) => {
  const chartData = useMemo(
    () =>
      data.map(point => ({
        ...point,
        bucketLabel: formatBucketLabel(
          point.bucketStart as string,
          granularity,
        ),
      })),
    [data, granularity],
  );

  const hasData = chartData.length > 0;

  const renderTooltipValue = (value: number | string, name: string) => [
    valueFormatter(Number(value)),
    name,
  ];

  const axisProps = {
    dataKey: 'bucketLabel',
    tick: { fontSize: 11 },
    minTickGap: 24,
  };
  const yAxisProps = {
    tick: { fontSize: 11 },
    width: 48,
    tickFormatter: (value: number) => valueFormatter(value),
  };

  return (
    <Card variant="outlined">
      <CardHeader
        title={title}
        titleTypographyProps={{ variant: 'subtitle1' }}
      />
      <CardContent>
        {!hasData ? (
          <Typography
            variant="body2"
            color="textSecondary"
            style={{
              height: CHART_HEIGHT,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {emptyMessage ?? 'No data in the selected window'}
          </Typography>
        ) : (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            {variant === 'bar' ? (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis {...axisProps} />
                <YAxis {...yAxisProps} allowDecimals={false} />
                <Tooltip formatter={renderTooltipValue} />
                {series.map(s => (
                  <Bar
                    key={s.dataKey}
                    dataKey={s.dataKey}
                    name={s.label}
                    fill={s.color}
                    radius={[2, 2, 0, 0]}
                  />
                ))}
              </BarChart>
            ) : (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis {...axisProps} />
                <YAxis {...yAxisProps} />
                <Tooltip formatter={renderTooltipValue} />
                {series.map(s => (
                  <Line
                    key={s.dataKey}
                    type="monotone"
                    dataKey={s.dataKey}
                    name={s.label}
                    stroke={s.color}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
