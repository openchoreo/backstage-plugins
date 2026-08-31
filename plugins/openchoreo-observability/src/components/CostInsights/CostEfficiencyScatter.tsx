import { FC, useMemo, useState } from 'react';
import { Paper, Typography, makeStyles, useTheme } from '@material-ui/core';
import {
  Cell,
  LabelList,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import type { CostRow } from './types';
import { ChartTitle } from './ChartTitle';
import { formatAxisCost } from './chartUtils';
import { formatCost, formatEfficiency } from './format';

const LOW_EFFICIENCY_THRESHOLD = 0.4;
const LEGEND_LIMIT = 10;

const useStyles = makeStyles(theme => ({
  container: {
    padding: theme.spacing(2),
    height: 360,
    display: 'flex',
    flexDirection: 'column',
  },
  header: { marginBottom: theme.spacing(1) },
  body: { flex: 1, minHeight: 0, display: 'flex', gap: theme.spacing(1) },
  chart: { flex: 1, minWidth: 0 },
  legend: {
    width: 180,
    overflowY: 'auto',
    fontSize: 12,
    color: theme.palette.text.primary,
  },
  legendRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.25, 0),
  },
  badge: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    color: '#fff',
    fontSize: 11,
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  legendLabel: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  legendValue: { fontWeight: 500 },
  empty: {
    height: 360,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

interface Point {
  x: number;
  y: number;
  z: number;
  rank: number;
  label: string;
  saving: number;
  color: string;
}

export interface CostEfficiencyScatterProps {
  rows: CostRow[];
  title?: string;
}

export const CostEfficiencyScatter: FC<CostEfficiencyScatterProps> = ({
  rows,
  title = 'Cost vs efficiency',
}) => {
  const classes = useStyles();
  const theme = useTheme();
  const dark = theme.palette.type === 'dark';

  // Legend-toggled points; hidden labels are dimmed in the legend and not drawn.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (label: string) =>
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  const effColor = (eff: number): string => {
    if (eff < LOW_EFFICIENCY_THRESHOLD) return dark ? '#d98c74' : '#b06636';
    if (eff < 0.7) return dark ? '#d8c85f' : '#b6952f';
    return dark ? '#4fc0a4' : '#2f8f7a';
  };

  const anySaving = rows.some(r => (r.saving ?? 0) > 0);

  const points: Point[] = useMemo(
    () =>
      rows
        .slice()
        .sort((a, b) => b.total - a.total)
        .map((row, i) => ({
          x: Math.round((row.efficiency ?? 0) * 100),
          y: row.total,
          z: anySaving ? row.saving ?? 0 : row.total,
          rank: i + 1,
          label: row.label,
          saving: row.saving ?? 0,
          color: effColor(row.efficiency ?? 0),
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, anySaving, dark],
  );

  if (points.length === 0) {
    return (
      <Paper variant="outlined" className={classes.empty}>
        <Typography color="textSecondary">
          No cost data for the selected scope, environments and time range.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" className={classes.container}>
      <ChartTitle
        title={title}
        className={classes.header}
        info="Each bubble is one dimension: x is resource efficiency, y is spend, and bubble size is the estimated saving. Bubbles in the shaded band are low-efficiency spend worth reviewing first."
      />
      <div className={classes.body}>
        <div className={classes.chart}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
              <ReferenceArea
                x1={0}
                x2={LOW_EFFICIENCY_THRESHOLD * 100}
                fill={dark ? '#b06636' : '#a53f63'}
                fillOpacity={0.08}
                label={{
                  value: 'LOW EFFICIENCY',
                  position: 'insideBottomLeft',
                  fontSize: 10,
                  fill: theme.palette.text.secondary,
                }}
              />
              <XAxis
                type="number"
                dataKey="x"
                name="Efficiency"
                unit="%"
                domain={[0, 100]}
                tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                label={{
                  value: 'Efficiency →',
                  position: 'insideBottom',
                  offset: -12,
                  fontSize: 12,
                  fill: theme.palette.text.secondary,
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Spend"
                width={64}
                tickFormatter={formatAxisCost}
                tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
              />
              <ZAxis type="number" dataKey="z" range={[120, 900]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as Point;
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
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>
                        {p.rank}. {p.label}
                      </div>
                      <div>cost ${formatCost(p.y)}</div>
                      <div>efficiency {formatEfficiency(p.x / 100)}</div>
                      <div>potential saving ${formatCost(p.saving)}</div>
                    </div>
                  );
                }}
              />
              <Scatter
                data={points.filter(p => !hidden.has(p.label))}
                fillOpacity={0.85}
              >
                {points
                  .filter(p => !hidden.has(p.label))
                  .map(p => (
                    <Cell key={p.label} fill={p.color} />
                  ))}
                <LabelList
                  dataKey="rank"
                  position="center"
                  fill="#fff"
                  fontSize={11}
                  fontWeight={600}
                />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className={classes.legend}>
          {points.slice(0, LEGEND_LIMIT).map(p => (
            <div
              key={p.label}
              role="button"
              tabIndex={0}
              onClick={() => toggle(p.label)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') toggle(p.label);
              }}
              className={classes.legendRow}
              style={{
                cursor: 'pointer',
                opacity: hidden.has(p.label) ? 0.4 : 1,
                textDecoration: hidden.has(p.label) ? 'line-through' : 'none',
              }}
            >
              <span
                className={classes.badge}
                style={{ backgroundColor: p.color }}
              >
                {p.rank}
              </span>
              <span className={classes.legendLabel} title={p.label}>
                {p.label}
              </span>
              <span className={classes.legendValue}>
                {formatCost(anySaving ? p.saving : p.y)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Paper>
  );
};
