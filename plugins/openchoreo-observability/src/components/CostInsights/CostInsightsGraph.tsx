import { FC, useMemo, useState } from 'react';
import { Paper, Typography, makeStyles, useTheme } from '@material-ui/core';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CostSeriesPoint } from './types';
import { ChartTitle } from './ChartTitle';
import {
  FILL_OPACITY,
  MAX_BAR_SIZE,
  MIN_BUCKET_WIDTH,
  PALETTE_DARK,
  PALETTE_LIGHT,
  buildColorMap,
  formatAxisCost,
  formatBucket,
  savingColor,
} from './chartUtils';

const useStyles = makeStyles(theme => ({
  container: {
    padding: theme.spacing(2),
    height: 420,
    display: 'flex',
    flexDirection: 'column',
  },
  chart: { flex: 1, minHeight: 0 },
  empty: {
    height: 420,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    height: '100%',
    overflowX: 'auto',
    overflowY: 'hidden',
  },
}));

const AFTER_REC_KEY = '__afterRec';
const AFTER_REC_LABEL = 'If recommendations applied';

export interface CostStackTooltipContentProps {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: readonly any[];
  label?: string | number;
  seriesKeys: string[];
  /** The hovered stacked segment, whose row is highlighted. */
  activeKey: string | null;
  colorFor: Map<string, string>;
}

/** Bar-chart hover tooltip: per-segment rows (active one highlighted) + total. */
export const CostStackTooltipContent: FC<CostStackTooltipContentProps> = ({
  active,
  payload,
  label,
  seriesKeys,
  activeKey,
  colorFor,
}) => {
  const theme = useTheme();
  const green = savingColor(theme.palette.type === 'dark');
  if (!active || !payload?.length) return null;
  const rows = payload.filter(e => seriesKeys.includes(String(e.dataKey)));
  const afterRec = payload.find(e => e.dataKey === AFTER_REC_KEY);
  const total = rows.reduce((sum, e) => sum + (Number(e.value) || 0), 0);
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
      {/* Top-to-bottom mirrors the stacked bar (top series first). */}
      {[...rows].reverse().map(entry => {
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
                opacity: FILL_OPACITY,
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
      {afterRec && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            lineHeight: 1.6,
            marginTop: 4,
            color: green,
            fontWeight: 500,
          }}
        >
          <span>{AFTER_REC_LABEL}</span>
          <span style={{ marginLeft: 'auto' }}>
            ${Number(afterRec.value).toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
};

export interface RecommendationOverlay {
  savingFraction: number;
}

export interface CostInsightsGraphProps {
  series: CostSeriesPoint[];
  seriesKeys: string[];
  title?: string;
  /** When set (component level), overlays the post-recommendation cost. */
  recommendationOverlay?: RecommendationOverlay;
}

export const CostInsightsGraph: FC<CostInsightsGraphProps> = ({
  series,
  seriesKeys,
  title,
  recommendationOverlay,
}) => {
  const classes = useStyles();
  const theme = useTheme();
  const dark = theme.palette.type === 'dark';
  const palette = dark ? PALETTE_DARK : PALETTE_LIGHT;
  const green = savingColor(dark);

  const colorFor = useMemo(
    () => buildColorMap(seriesKeys, palette),
    [seriesKeys, palette],
  );
  // Legend-toggled series; hidden keys are dimmed in the legend and not drawn.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  // The stacked segment the pointer is over, so its tooltip row can be
  // highlighted. Cleared when the pointer leaves the chart.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const toggle = (key: string) =>
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Augment each bucket with the post-recommendation total, used only when
  // overlaying the "cost after recommendations" line.
  const data = useMemo(() => {
    if (!recommendationOverlay) return series;
    const factor = 1 - recommendationOverlay.savingFraction;
    return series.map(point => {
      // Sum only the visible stacks so the overlay tracks what's drawn.
      const total = seriesKeys.reduce(
        (sum, key) =>
          hidden.has(key) || typeof point[key] !== 'number'
            ? sum
            : sum + (point[key] as number),
        0,
      );
      return { ...point, [AFTER_REC_KEY]: total * factor };
    });
  }, [series, seriesKeys, recommendationOverlay, hidden]);

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
      {title && (
        <ChartTitle
          title={title}
          info={`Cost per dimension across time buckets, stacked to show the total.${
            recommendationOverlay
              ? ' The dashed line shows the total cost if the recommendations were applied.'
              : ''
          }`}
        />
      )}
      <div className={classes.chart}>
        <div className={classes.scroll}>
          <div
            style={{
              height: '100%',
              width: `max(100%, ${series.length * MIN_BUCKET_WIDTH}px)`,
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={data}
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
                  cursor={{ fill: theme.palette.action.hover }}
                  content={props => (
                    <CostStackTooltipContent
                      active={props.active}
                      payload={props.payload}
                      label={props.label}
                      seriesKeys={seriesKeys}
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
                              width: 10,
                              height: 10,
                              borderRadius: 2,
                              backgroundColor: colorFor.get(key),
                              opacity: FILL_OPACITY,
                              flexShrink: 0,
                            }}
                          />
                          {key}
                        </span>
                      ))}
                      {recommendationOverlay && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={() => toggle(AFTER_REC_KEY)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ')
                              toggle(AFTER_REC_KEY);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            cursor: 'pointer',
                            color: green,
                            opacity: hidden.has(AFTER_REC_KEY) ? 0.4 : 1,
                            textDecoration: hidden.has(AFTER_REC_KEY)
                              ? 'line-through'
                              : 'none',
                          }}
                        >
                          <span
                            style={{
                              width: 14,
                              height: 0,
                              borderTop: `2px dashed ${green}`,
                              flexShrink: 0,
                            }}
                          />
                          {AFTER_REC_LABEL}
                        </span>
                      )}
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
                    hide={hidden.has(key)}
                    onMouseEnter={() => setActiveKey(key)}
                  />
                ))}
                {recommendationOverlay && (
                  <Line
                    dataKey={AFTER_REC_KEY}
                    stroke={green}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                    name={AFTER_REC_LABEL}
                    isAnimationActive={false}
                    legendType="none"
                    hide={hidden.has(AFTER_REC_KEY)}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Paper>
  );
};
