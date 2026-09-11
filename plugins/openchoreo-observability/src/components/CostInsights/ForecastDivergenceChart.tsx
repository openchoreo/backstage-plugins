import { FC, useMemo, useState } from 'react';
import { Paper, Typography, makeStyles, useTheme } from '@material-ui/core';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ForecastData } from './types';
import { ChartTitle } from './ChartTitle';
import {
  PALETTE_DARK,
  PALETTE_LIGHT,
  formatAxisCost,
  formatBucket,
  savingColor,
} from './chartUtils';

const useStyles = makeStyles(theme => ({
  container: {
    padding: theme.spacing(2),
    height: 360,
    display: 'flex',
    flexDirection: 'column',
  },
  header: { marginBottom: theme.spacing(1) },
  chart: { flex: 1, minHeight: 0 },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing(0.5, 1.5),
    paddingTop: theme.spacing(1),
    color: theme.palette.text.primary,
    fontSize: 12,
  },
  legendItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
  },
  empty: {
    height: 360,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

export interface ForecastDivergenceChartProps {
  forecast: ForecastData | null;
  title?: string;
}

export const ForecastDivergenceChart: FC<ForecastDivergenceChartProps> = ({
  forecast,
  title = 'Accumulated cost and forecast',
}) => {
  const classes = useStyles();
  const theme = useTheme();
  const dark = theme.palette.type === 'dark';
  const blue = (dark ? PALETTE_DARK : PALETTE_LIGHT)[0];
  const green = savingColor(dark);

  // Legend-toggled series; hidden keys are dimmed in the legend and not drawn.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  // strokeDasharray per series: solid for actual cost, dashes for the current-rate
  // forecast, round dots for the if-applied forecast.
  const DASH = { actual: undefined, forecast: '8 6', ifApplied: '1 9' };
  const legendItems = [
    { key: 'actual', name: 'accumulated cost', color: blue, dash: DASH.actual },
    {
      key: 'forecast',
      name: 'forecast at current rate',
      color: blue,
      dash: DASH.forecast,
    },
    {
      key: 'ifApplied',
      name: 'forecast if recommendations applied',
      color: green,
      dash: DASH.ifApplied,
    },
  ];

  const data = useMemo(
    () =>
      (forecast?.points ?? []).map(p => ({
        ...p,
        t: new Date(p.timestamp).getTime(),
      })),
    [forecast],
  );

  // Month label from the first (month-start) point.
  const monthLabel =
    data.length > 0
      ? new Date(data[0].t).toLocaleDateString(undefined, {
          month: 'long',
          year: 'numeric',
        })
      : '';

  if (!forecast || data.length === 0) {
    return (
      <Paper variant="outlined" className={classes.empty}>
        <Typography color="textSecondary">
          Not enough data yet to forecast this month's cost.
        </Typography>
      </Paper>
    );
  }

  const lastIndex = data.length - 1;
  const endLabel =
    (text: string, color: string, dy: number) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (props: any) => {
      if (props.index !== lastIndex) return null;
      const { x = 0, y = 0 } = props;
      return (
        <text
          x={x - 6}
          y={y + dy}
          textAnchor="end"
          dominantBaseline="central"
          fill={color}
          fontSize={12}
          fontWeight={600}
        >
          {text}
        </text>
      );
    };

  return (
    <Paper variant="outlined" className={classes.container}>
      <ChartTitle
        title={title}
        subtitle={monthLabel}
        className={classes.header}
        info="The solid part shows the accumulated cost so far this calendar month. Each point is the running total from the 1st to that date. Then two forecast projections to month end; the forecast cost at the current rate, and the forecast cost if recommendations are applied. The gap between them is the potential saving."
      />
      <div className={classes.chart}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 24, right: 16, bottom: 8, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={theme.palette.divider}
            />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={ms => formatBucket(new Date(ms).toISOString())}
              tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
            />
            <YAxis
              tickFormatter={formatAxisCost}
              width={64}
              tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                // Up to today the point is on the actual-cost curve, so show only
                // "actual cost"; past today show the two projections.
                const defined = payload.filter(
                  e =>
                    e.value !== null &&
                    e.value !== undefined &&
                    Number.isFinite(Number(e.value)),
                );
                const actual = defined.find(e => e.dataKey === 'actual');
                const shown = actual
                  ? [actual]
                  : defined.filter(e => e.dataKey !== 'actual');
                if (!shown.length) return null;
                return (
                  <div
                    style={{
                      backgroundColor: theme.palette.background.paper,
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: 4,
                      padding: theme.spacing(1, 1.5),
                      color: theme.palette.text.primary,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ marginBottom: 4, fontWeight: 500 }}>
                      {formatBucket(new Date(Number(label)).toISOString())}
                    </div>
                    {shown.map(entry => (
                      <div
                        key={String(entry.dataKey)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          lineHeight: 1.6,
                          color: entry.color,
                        }}
                      >
                        <span>{entry.name}</span>
                        <span style={{ marginLeft: 'auto', fontWeight: 500 }}>
                          ${Number(entry.value).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            <Area
              dataKey="actual"
              name="accumulated cost"
              stroke={blue}
              strokeWidth={2}
              fill={blue}
              fillOpacity={0.28}
              dot={false}
              connectNulls
              hide={hidden.has('actual')}
              isAnimationActive={false}
            />
            <Area
              dataKey="forecast"
              name="forecast at current rate"
              stroke={blue}
              strokeWidth={2}
              strokeDasharray={DASH.forecast}
              fill={blue}
              fillOpacity={0.08}
              dot={false}
              connectNulls
              hide={hidden.has('forecast')}
              isAnimationActive={false}
            >
              <LabelList
                content={endLabel('forecast at current rate', blue, -12)}
              />
            </Area>
            <Line
              dataKey="ifApplied"
              name="forecast if recommendations applied"
              stroke={green}
              strokeWidth={3}
              strokeDasharray={DASH.ifApplied}
              strokeLinecap="round"
              dot={false}
              connectNulls
              hide={hidden.has('ifApplied')}
              isAnimationActive={false}
            >
              <LabelList
                content={endLabel(
                  'forecast if recommendations are applied',
                  green,
                  14,
                )}
              />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className={classes.legend}>
        {legendItems.map(item => (
          <span
            key={item.key}
            role="button"
            tabIndex={0}
            onClick={() => toggle(item.key)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') toggle(item.key);
            }}
            className={classes.legendItem}
            style={{
              opacity: hidden.has(item.key) ? 0.4 : 1,
              textDecoration: hidden.has(item.key) ? 'line-through' : 'none',
            }}
          >
            <svg
              width={26}
              height={8}
              style={{ flexShrink: 0, overflow: 'visible' }}
              aria-hidden
            >
              <line
                x1={0}
                y1={4}
                x2={26}
                y2={4}
                stroke={item.color}
                strokeWidth={item.dash === DASH.ifApplied ? 3 : 2}
                strokeDasharray={item.dash}
                strokeLinecap="round"
              />
            </svg>
            {item.name}
          </span>
        ))}
      </div>
    </Paper>
  );
};
