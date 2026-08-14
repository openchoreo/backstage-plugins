import { FC, useMemo, useState } from 'react';
import { Paper, Typography, makeStyles, useTheme } from '@material-ui/core';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CostSeriesPoint } from './types';
import { ChartTitle } from './ChartTitle';
import {
  PALETTE_DARK,
  PALETTE_LIGHT,
  buildColorMap,
  formatAxisCost,
  formatBucket,
} from './chartUtils';

const useStyles = makeStyles(theme => ({
  container: {
    padding: theme.spacing(2),
    height: 360,
    display: 'flex',
    flexDirection: 'column',
  },
  chart: { flex: 1, minHeight: 0 },
  empty: {
    height: 360,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

export interface CostLineTooltipContentProps {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: readonly any[];
  label?: string | number;
  /** The hovered line, whose row is highlighted. */
  activeKey: string | null;
  colorFor: Map<string, string>;
}

/** Line-chart hover tooltip: per-line rows (active one highlighted) + total. */
export const CostLineTooltipContent: FC<CostLineTooltipContentProps> = ({
  active,
  payload,
  label,
  activeKey,
  colorFor,
}) => {
  const theme = useTheme();
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum, e) => sum + (Number(e.value) || 0), 0);
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
        {formatBucket(String(label))}
      </div>
      {/* Highest line first, so the order matches the chart. */}
      {[...payload]
        .sort((a, b) => Number(b.value) - Number(a.value))
        .map(entry => {
          const isActive = String(entry.dataKey) === activeKey;
          return (
            <div
              key={String(entry.dataKey)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                lineHeight: 1.6,
                margin: theme.spacing(0, -1),
                padding: theme.spacing(0, 1),
                borderRadius: 2,
                backgroundColor: isActive
                  ? theme.palette.action.selected
                  : 'transparent',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  backgroundColor: colorFor.get(String(entry.dataKey)),
                  flexShrink: 0,
                }}
              />
              <span>{entry.name}</span>
              <span style={{ marginLeft: 'auto' }}>
                ${Number(entry.value).toFixed(2)}
              </span>
            </div>
          );
        })}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          lineHeight: 1.6,
          marginTop: 4,
          paddingTop: 4,
          borderTop: `1px solid ${theme.palette.divider}`,
          fontWeight: 600,
        }}
      >
        <span>Total</span>
        <span style={{ marginLeft: 'auto' }}>${total.toFixed(2)}</span>
      </div>
    </div>
  );
};

export interface CostLineChartProps {
  series: CostSeriesPoint[];
  seriesKeys: string[];
  title?: string;
}

export const CostLineChart: FC<CostLineChartProps> = ({
  series,
  seriesKeys,
  title = 'Cost over time',
}) => {
  const classes = useStyles();
  const theme = useTheme();
  const dark = theme.palette.type === 'dark';
  const palette = dark ? PALETTE_DARK : PALETTE_LIGHT;

  const colorFor = useMemo(
    () => buildColorMap(seriesKeys, palette),
    [seriesKeys, palette],
  );
  // Legend-toggled series; hidden keys are dimmed in the legend and not drawn.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  // The line the pointer is over, so its tooltip row can be highlighted.
  // Cleared when the pointer leaves the chart.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const toggle = (key: string) =>
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (series.length === 0 || seriesKeys.length === 0) {
    return (
      <Paper variant="outlined" className={classes.empty}>
        <Typography color="textSecondary">
          No cost data to plot for the selected scope, environments and time
          range.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" className={classes.container}>
      <ChartTitle
        title={title}
        info="Cost over time for each dimension, one line per dimension."
      />
      <div className={classes.chart}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={series}
            margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
            onMouseLeave={() => setActiveKey(null)}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={theme.palette.divider}
            />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatBucket}
              tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
            />
            <YAxis
              tickFormatter={formatAxisCost}
              width={64}
              tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
            />
            <Tooltip
              content={props => (
                <CostLineTooltipContent
                  active={props.active}
                  payload={props.payload}
                  label={props.label}
                  activeKey={activeKey}
                  colorFor={colorFor}
                />
              )}
            />
            <Legend
              content={() => (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: theme.spacing(0.5, 1.5),
                    paddingTop: theme.spacing(1),
                    color: theme.palette.text.primary,
                    fontSize: 12,
                  }}
                >
                  {seriesKeys.map(key => (
                    <span
                      key={key}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggle(key)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') toggle(key);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        opacity: hidden.has(key) ? 0.4 : 1,
                        textDecoration: hidden.has(key)
                          ? 'line-through'
                          : 'none',
                      }}
                    >
                      <span
                        style={{
                          width: 14,
                          height: 0,
                          borderTop: `2px solid ${colorFor.get(key)}`,
                          flexShrink: 0,
                        }}
                      />
                      {key}
                    </span>
                  ))}
                </div>
              )}
            />
            {seriesKeys.map(key => (
              <Line
                key={key}
                dataKey={key}
                name={key}
                stroke={colorFor.get(key)}
                strokeWidth={2}
                dot={false}
                connectNulls
                hide={hidden.has(key)}
                isAnimationActive={false}
                onMouseEnter={() => setActiveKey(key)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Paper>
  );
};
