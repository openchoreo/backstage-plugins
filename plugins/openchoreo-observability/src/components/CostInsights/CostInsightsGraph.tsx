import { FC, useMemo } from 'react';
import { Paper, Typography, makeStyles, useTheme } from '@material-ui/core';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CostSeriesPoint } from './types';

const useStyles = makeStyles(theme => ({
  container: {
    padding: theme.spacing(2),
    height: 420,
  },
  empty: {
    height: 420,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Horizontal scroll kicks in only when the chart's min width exceeds the
  // container (many buckets); otherwise it just fills the available space.
  scroll: {
    height: '100%',
    overflowX: 'auto',
    overflowY: 'hidden',
  },
}));

// Curated categorical palettes for the stacked series. The colours are muted
// mid-tones (calm rather than neon), yet each meets WCAG 2.2 AA / BITV 2.0
const PALETTE_LIGHT = [
  '#3f6cb0', // blue
  '#2f8f7a', // teal
  '#b06636', // rust
  '#845bb0', // violet
  '#a53f63', // rose
  '#6f7a2f', // olive
  '#2f8fae', // cyan
  '#8a6a34', // brown
  '#6f727a', // grey
  '#993f8f', // magenta
];
const PALETTE_DARK = [
  '#8fa8e0', // blue
  '#4fc0a4', // teal
  '#e0a074', // rust
  '#bb9fe0', // violet
  '#e07f9f', // rose
  '#b6c470', // olive
  '#5fc0e0', // cyan
  '#a7adb8', // grey
  '#d8c85f', // yellow
  '#d98fd0', // magenta
];

const FILL_OPACITY = 0.9;

// Cap each bar's width so a lone bucket doesn't stretch across the whole chart;
// it stays this wide and centred regardless of how few bars there are.
const MAX_BAR_SIZE = 64;
// Minimum horizontal room per bucket. Once there are enough buckets to exceed
// the container, the chart grows to this width per bucket and scrolls sideways
const MIN_BUCKET_WIDTH = 48;

// Costs are often sub-dollar; scale the decimal precision to the axis range so
// small values don't all collapse to "$0".
const formatAxisCost = (value: number): string => {
  if (value === 0) return '$0';
  const abs = Math.abs(value);
  let digits = 0;
  if (abs < 0.01) digits = 4;
  else if (abs < 0.1) digits = 3;
  else if (abs < 1) digits = 2;
  else if (abs < 10) digits = 1;
  return `$${value.toFixed(digits)}`;
};

const formatBucket = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export interface CostInsightsGraphProps {
  series: CostSeriesPoint[];
  seriesKeys: string[];
}

export const CostInsightsGraph: FC<CostInsightsGraphProps> = ({
  series,
  seriesKeys,
}) => {
  const classes = useStyles();
  const theme = useTheme();
  const dark = theme.palette.type === 'dark';

  // Theme-aware categorical palette; flips with light/dark.
  const palette = dark ? PALETTE_DARK : PALETTE_LIGHT;

  // Deterministic per-key colour assignment so a series keeps its colour across
  // re-renders. With more series than palette entries the colours wrap.
  const colorFor = useMemo(() => {
    const map = new Map<string, string>();
    seriesKeys.forEach((key, i) => map.set(key, palette[i % palette.length]));
    return map;
  }, [seriesKeys, palette]);

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
      <div className={classes.scroll}>
        <div
          style={{
            height: '100%',
            width: `max(100%, ${series.length * MIN_BUCKET_WIDTH}px)`,
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={series}
              margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
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
                cursor={{ fill: theme.palette.action.hover }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
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
                      {/* List top-to-bottom to mirror the stacked bar: the last
                      series is drawn on top, so it appears first here. */}
                      {[...payload].reverse().map(entry => {
                        const colour = colorFor.get(String(entry.dataKey));
                        return (
                          <div
                            key={String(entry.dataKey)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              lineHeight: 1.6,
                            }}
                          >
                            {/* Colour swatch tying the row back to its stacked bar. */}
                            <span
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 2,
                                backgroundColor: colour,
                                opacity: FILL_OPACITY,
                                flexShrink: 0,
                              }}
                            />
                            <span>{entry.name}</span>
                            <span
                              style={{ marginLeft: 'auto', fontWeight: 500 }}
                            >
                              ${Number(entry.value).toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                }}
              />
              <Legend
                content={({ payload }) => (
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
                    {payload?.map(entry => {
                      const key = String(entry.dataKey ?? entry.value);
                      return (
                        <span
                          key={key}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          {/* Swatch at the same opacity as the bars. */}
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 2,
                              backgroundColor: colorFor.get(key),
                              opacity: FILL_OPACITY,
                              flexShrink: 0,
                            }}
                          />
                          {String(entry.value)}
                        </span>
                      );
                    })}
                  </div>
                )}
              />
              {seriesKeys.map(key => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="cost"
                  fill={colorFor.get(key)}
                  fillOpacity={FILL_OPACITY}
                  name={key}
                  maxBarSize={MAX_BAR_SIZE}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Paper>
  );
};
