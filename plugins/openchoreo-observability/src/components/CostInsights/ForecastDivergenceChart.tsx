import { FC, useMemo, useState } from 'react';
import { Paper, Typography, makeStyles, useTheme } from '@material-ui/core';
import {
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
  title = 'Spend forecast',
}) => {
  const classes = useStyles();
  const theme = useTheme();
  const dark = theme.palette.type === 'dark';
  const blue = (dark ? PALETTE_DARK : PALETTE_LIGHT)[0];
  const green = savingColor(dark);

  // Legend-toggled lines; hidden keys are dimmed in the legend and not drawn.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const legendItems = [
    { key: 'actual', name: 'so far', color: blue, dashed: false },
    { key: 'atCurrent', name: 'at current rate', color: blue, dashed: true },
    { key: 'ifApplied', name: 'if applied', color: green, dashed: true },
  ];

  const data = useMemo(
    () =>
      (forecast?.points ?? []).map(p => ({
        ...p,
        t: new Date(p.timestamp).getTime(),
      })),
    [forecast],
  );

  if (!forecast || data.length === 0) {
    return (
      <Paper variant="outlined" className={classes.empty}>
        <Typography color="textSecondary">
          Not enough data to project a forecast for this window.
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
        className={classes.header}
        info="Cumulative spend so far this month (solid), then two projections to month end: at the current rate, and if the cost recommendations are applied. The gap is the potential saving. Extrapolates the selected time window's spend rate across the whole month. Hence the forecast can change with the time range you pick, especially when only part of that range has cost data."
      />
      <div className={classes.chart}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
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
                // Up to now the point is on the single actual line, so show only
                // "so far"; past now show the two projections.
                const actual = payload.find(e => e.dataKey === 'actual');
                const shown = actual
                  ? [actual]
                  : payload.filter(e => e.dataKey !== 'actual');
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
            <Line
              dataKey="actual"
              name="so far"
              stroke={blue}
              strokeWidth={2}
              dot={false}
              connectNulls
              hide={hidden.has('actual')}
              isAnimationActive={false}
            />
            <Line
              dataKey="atCurrent"
              name="at current rate"
              stroke={blue}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              connectNulls
              hide={hidden.has('atCurrent')}
              isAnimationActive={false}
            >
              <LabelList content={endLabel('at current rate', blue, -12)} />
            </Line>
            <Line
              dataKey="ifApplied"
              name="if recommendations applied"
              stroke={green}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              connectNulls
              hide={hidden.has('ifApplied')}
              isAnimationActive={false}
            >
              <LabelList content={endLabel('if applied', green, 14)} />
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
            <span
              style={{
                width: 14,
                height: 0,
                borderTop: `2px ${item.dashed ? 'dashed' : 'solid'} ${
                  item.color
                }`,
                flexShrink: 0,
              }}
            />
            {item.name}
          </span>
        ))}
      </div>
    </Paper>
  );
};
