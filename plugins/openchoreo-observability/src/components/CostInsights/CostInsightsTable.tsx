import { FC, useMemo, useState } from 'react';
import {
  Link,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
  Paper,
  makeStyles,
} from '@material-ui/core';
import type { IconComponent } from '@backstage/core-plugin-api';
import type {
  CostRow,
  CostRowRecommendation,
  CostScope,
  CostScopeLevel,
} from './types';
import { formatCost, formatEfficiency, formatDelta } from './format';
import { CostOptimizeButton } from './CostOptimizeButton';
import { hasApplyableRecommendation } from './optimizeChange';

/** Human-readable local time for the binding's spec update, shown in the notice. */
function formatSpecUpdateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const useStyles = makeStyles(theme => ({
  numeric: { textAlign: 'right', whiteSpace: 'nowrap' },
  up: { color: theme.palette.error.main },
  down: { color: theme.palette.success.main },
  savings: { color: theme.palette.success.main, fontWeight: 600 },
  // Bold, link-coloured dimension names, matching the catalog table.
  nameCell: { fontWeight: 600 },
  nameWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  kindIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    color: theme.palette.text.secondary,
    flexShrink: 0,
    '& svg': { fontSize: 18, display: 'block' },
  },
  drillLink: {
    textAlign: 'left',
    font: 'inherit',
    fontWeight: 600,
    cursor: 'pointer',
  },
  empty: { padding: theme.spacing(4), textAlign: 'center' },
  // Extra vertical room for the stacked cell content.
  recRow: {
    '& > td': {
      paddingTop: theme.spacing(2),
      paddingBottom: theme.spacing(2),
    },
  },

  // Component-level recommendation table
  envCell: { whiteSpace: 'nowrap' },
  envWrap: { display: 'flex', alignItems: 'center', gap: theme.spacing(1.5) },
  envDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: theme.palette.primary.main,
    flexShrink: 0,
  },
  envName: { fontWeight: 700, fontSize: '1rem' },
  costMain: { fontWeight: 600 },
  subText: {
    color: theme.palette.text.secondary,
    fontSize: '0.75rem',
    whiteSpace: 'nowrap',
  },
  effWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
  },
  effBar: {
    flexGrow: 1,
    minWidth: 80,
    maxWidth: 160,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.palette.divider,
  },
  effValue: { minWidth: 40, whiteSpace: 'nowrap' },
  change: {
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    whiteSpace: 'nowrap',
  },
  staleNotice: {
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
    fontSize: '0.8rem',
  },
  changeNew: { color: theme.palette.success.main },
  changeEmpty: { color: theme.palette.text.secondary },
  savingMain: {
    color: theme.palette.success.main,
    fontWeight: 700,
    fontSize: '1.1rem',
  },
  actionCell: { textAlign: 'right', whiteSpace: 'nowrap' },
}));

const dimensionHeader = (level: CostScopeLevel): string => {
  switch (level) {
    case 'namespace':
      return 'Project';
    case 'project':
      return 'Component';
    case 'component':
    default:
      return 'Environment';
  }
};

type SortId =
  | 'name'
  | 'cpuCost'
  | 'memoryCost'
  | 'efficiency'
  | 'total'
  | 'deltaPct';
type SortOrder = 'asc' | 'desc';

const DeltaCell: FC<{ deltaPct: number | null }> = ({ deltaPct }) => {
  const classes = useStyles();
  let cls = '';
  // Only color finite deltas; non-finite values (e.g. Infinity) render as the
  // neutral em dash, so leave them uncolored too.
  if (deltaPct !== null && Number.isFinite(deltaPct)) {
    if (deltaPct > 0) cls = classes.up;
    else if (deltaPct < 0) cls = classes.down;
  }
  return <span className={cls}>{formatDelta(deltaPct)}</span>;
};

export interface CostInsightsTableProps {
  level: CostScopeLevel;
  rows: CostRow[];
  /**
   * Drill into a row's dimension (namespace to project, project to component). When
   * omitted (component level, whose rows are leaf environments) the dimension
   * renders as plain text.
   */
  onDrill?: (key: string) => void;
  /** Entity-kind icon shown before each name (matches the catalog symbols). */
  icon?: IconComponent;
  /** Raw dimension name to catalog title, for display (keys stay raw names). */
  titles?: Record<string, string>;
  /** Current scope, needed to apply a recommendation (component level only). */
  scope?: CostScope;
  /** Called after an Optimize apply succeeds, so the page can refetch. */
  onOptimized?: () => void;
  /**
   * At the component level, whether exactly one component is in scope.
   * Recommendations/savings/apply are per-component, so they're shown only then;
   * with several components a note asks the user to select one.
   */
  singleComponent?: boolean;
}

const EmptyState: FC = () => {
  const classes = useStyles();
  return (
    <Paper variant="outlined">
      <Typography className={classes.empty} color="textSecondary">
        No cost data for the selected scope, environments and time range.
      </Typography>
    </Paper>
  );
};

/** The recommendation's total saving over the current spend (null if unknown). */
const savingOf = (row: CostRow): number | null =>
  row.recommendation ? row.total - row.recommendation.total : null;

/** Percent of current spend the recommendation saves (0 when no current spend). */
const savingPctOf = (row: CostRow): number | null => {
  const saving = savingOf(row);
  if (saving === null) return null;
  return row.total > 0 ? (saving / row.total) * 100 : 0;
};

/** One resource-request change (e.g. `cpu 100m → 12m`) driving the saving. */
interface ReqChange {
  label: string;
  from: string;
  to: string;
}

/** The request changes a recommendation applies, for the "Recommended change" column. */
function recommendedChanges(
  rec: CostRowRecommendation | undefined,
): ReqChange[] {
  if (!rec) return [];
  const current = rec.current ?? {};
  const changes: ReqChange[] = [];
  if (
    rec.cpuRequest &&
    current.cpuRequest &&
    rec.cpuRequest !== current.cpuRequest
  ) {
    changes.push({
      label: 'cpu',
      from: current.cpuRequest,
      to: rec.cpuRequest,
    });
  }
  if (
    rec.memoryRequest &&
    current.memoryRequest &&
    rec.memoryRequest !== current.memoryRequest
  ) {
    changes.push({
      label: 'memory',
      from: current.memoryRequest,
      to: rec.memoryRequest,
    });
  }
  return changes;
}

/**
 * Component-level cost table: one row per environment, surfacing the right-sizing
 * recommendation. current cost breakdown, efficiency bar, the resource change
 * that drives the saving, the saving itself, and an Apply button. Sorted by
 * saving (highest first) by default.
 */
const RecommendationCostTable: FC<CostInsightsTableProps> = ({
  rows,
  titles,
  scope,
  onOptimized,
  singleComponent = true,
}) => {
  const classes = useStyles();
  const [orderBy, setOrderBy] = useState<
    'name' | 'total' | 'efficiency' | 'saving'
  >(singleComponent ? 'saving' : 'total');
  const [order, setOrder] = useState<SortOrder>('desc');

  const onSort = (id: typeof orderBy) => {
    if (orderBy === id) {
      setOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrderBy(id);
      setOrder(id === 'name' ? 'asc' : 'desc');
    }
  };

  const sortedRows = useMemo(() => {
    const decorated = rows.map(row => ({
      row,
      display: titles?.[row.key] ?? row.label,
    }));
    const factor = order === 'asc' ? 1 : -1;
    const valueOf = (row: CostRow): number | null => {
      switch (orderBy) {
        case 'total':
          return row.total;
        case 'efficiency':
          return row.efficiency;
        case 'saving':
        default:
          return savingOf(row);
      }
    };
    return decorated.sort((a, b) => {
      if (orderBy === 'name')
        return factor * a.display.localeCompare(b.display);
      const av = valueOf(a.row);
      const bv = valueOf(b.row);
      // Rows without a recommendation (null saving) always sort last.
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return factor * (av - bv);
    });
  }, [rows, titles, order, orderBy]);

  const sortLabel = (id: typeof orderBy, label: string) => (
    <TableSortLabel
      active={orderBy === id}
      direction={orderBy === id ? order : 'asc'}
      onClick={() => onSort(id)}
    >
      {label}
    </TableSortLabel>
  );

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table aria-label="Cost insights">
        <TableHead>
          <TableRow>
            <TableCell>{sortLabel('name', 'Environment')}</TableCell>
            <TableCell className={classes.numeric}>
              {sortLabel('total', 'Current cost (USD)')}
            </TableCell>
            <TableCell>{sortLabel('efficiency', 'Efficiency')}</TableCell>
            <TableCell>Recommended change</TableCell>
            <TableCell className={classes.numeric}>
              {sortLabel('saving', 'Saving (USD)')}
            </TableCell>
            <TableCell className={classes.actionCell} />
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedRows.map(({ row, display }) => {
            const changes = recommendedChanges(row.recommendation);
            const saving = savingOf(row);
            const savingPct = savingPctOf(row);
            let recommendationCells;
            if (!singleComponent) {
              recommendationCells = (
                <TableCell colSpan={3} className={classes.staleNotice}>
                  Select a single component to see recommended changes, savings
                  and to apply those recommendations.
                </TableCell>
              );
            } else if (row.recommendationStale) {
              recommendationCells = (
                <TableCell colSpan={3} className={classes.staleNotice}>
                  The component's release binding was updated
                  {row.recommendationStaleSince
                    ? ` on ${formatSpecUpdateTime(
                        row.recommendationStaleSince,
                      )}`
                    : ''}
                  , after this time window started, so recommendations can't be
                  shown. Select a time range that starts at least 5 minutes
                  after that time. The buffer lets fresh cost data be collected
                  for the updated spec.
                </TableCell>
              );
            } else {
              recommendationCells = (
                <>
                  <TableCell>
                    {changes.length === 0 ? (
                      <span className={classes.changeEmpty}>—</span>
                    ) : (
                      changes.map(c => (
                        <div key={c.label} className={classes.change}>
                          {c.label} {c.from}{' '}
                          <span className={classes.changeNew}>→ {c.to}</span>
                        </div>
                      ))
                    )}
                  </TableCell>
                  <TableCell className={classes.numeric}>
                    {saving === null || saving <= 0 ? (
                      '—'
                    ) : (
                      <>
                        <div className={classes.savingMain}>
                          {formatCost(saving)}
                        </div>
                        {savingPct !== null && (
                          <div className={classes.subText}>
                            {Math.round(savingPct)}%
                          </div>
                        )}
                      </>
                    )}
                  </TableCell>
                  <TableCell className={classes.actionCell}>
                    {scope &&
                      onOptimized &&
                      hasApplyableRecommendation(row.recommendation) && (
                        <CostOptimizeButton
                          env={row.key}
                          recommendation={row.recommendation}
                          scope={scope}
                          onOptimized={onOptimized}
                          disabled={changes.length === 0}
                        />
                      )}
                  </TableCell>
                </>
              );
            }
            return (
              <TableRow key={row.key} className={classes.recRow}>
                <TableCell className={classes.envCell}>
                  <span className={classes.envWrap}>
                    <span className={classes.envDot} />
                    <span className={classes.envName}>{display}</span>
                  </span>
                </TableCell>
                <TableCell className={classes.numeric}>
                  <div className={classes.costMain}>
                    {formatCost(row.total)}
                  </div>
                  <div className={classes.subText}>
                    cpu {formatCost(row.cpuCost)} · mem{' '}
                    {formatCost(row.memoryCost)}
                  </div>
                </TableCell>
                <TableCell>
                  <span className={classes.effWrap}>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(100, Math.max(0, row.efficiency * 100))}
                      className={classes.effBar}
                    />
                    <span className={classes.effValue}>
                      {formatEfficiency(row.efficiency)}
                    </span>
                  </span>
                </TableCell>
                {recommendationCells}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

/** Namespace / project level table: cost breakdown per dimension, drillable. */
const StandardCostTable: FC<CostInsightsTableProps> = ({
  level,
  rows,
  onDrill,
  icon: KindIcon,
  titles,
}) => {
  const classes = useStyles();
  const [orderBy, setOrderBy] = useState<SortId>('total');
  const [order, setOrder] = useState<SortOrder>('desc');

  const onSort = (id: SortId) => {
    if (orderBy === id) {
      setOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrderBy(id);
      setOrder(id === 'name' ? 'asc' : 'desc');
    }
  };

  const sortedRows = useMemo(() => {
    const decorated = rows.map(row => ({
      row,
      display: titles?.[row.key] ?? row.label,
    }));
    const factor = order === 'asc' ? 1 : -1;
    return decorated.sort((a, b) => {
      if (orderBy === 'name') {
        return factor * a.display.localeCompare(b.display);
      }
      const av = a.row[orderBy];
      const bv = b.row[orderBy];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return factor * (av - bv);
    });
  }, [rows, titles, order, orderBy]);

  const sortLabel = (id: SortId, label: string) => (
    <TableSortLabel
      active={orderBy === id}
      direction={orderBy === id ? order : 'asc'}
      onClick={() => onSort(id)}
    >
      {label}
    </TableSortLabel>
  );

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" aria-label="Cost insights">
        <TableHead>
          <TableRow>
            <TableCell sortDirection={orderBy === 'name' ? order : false}>
              {sortLabel('name', dimensionHeader(level))}
            </TableCell>
            <TableCell
              className={classes.numeric}
              sortDirection={orderBy === 'cpuCost' ? order : false}
            >
              {sortLabel('cpuCost', 'CPU (USD)')}
            </TableCell>
            <TableCell
              className={classes.numeric}
              sortDirection={orderBy === 'memoryCost' ? order : false}
            >
              {sortLabel('memoryCost', 'Memory (USD)')}
            </TableCell>
            <TableCell
              className={classes.numeric}
              sortDirection={orderBy === 'efficiency' ? order : false}
            >
              {sortLabel('efficiency', 'Efficiency')}
            </TableCell>
            <TableCell
              className={classes.numeric}
              sortDirection={orderBy === 'total' ? order : false}
            >
              {sortLabel('total', 'Total (USD)')}
            </TableCell>
            <TableCell
              className={classes.numeric}
              sortDirection={orderBy === 'deltaPct' ? order : false}
            >
              {sortLabel('deltaPct', 'Inc/dec vs prev window')}
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedRows.map(({ row, display }) => (
            <TableRow key={row.key}>
              <TableCell className={classes.nameCell}>
                <span className={classes.nameWrap}>
                  {KindIcon && (
                    <span className={classes.kindIcon}>
                      <KindIcon fontSize="small" />
                    </span>
                  )}
                  {onDrill ? (
                    <Link
                      component="button"
                      type="button"
                      color="primary"
                      className={classes.drillLink}
                      onClick={() => onDrill(row.key)}
                    >
                      {display}
                    </Link>
                  ) : (
                    display
                  )}
                </span>
              </TableCell>
              <TableCell className={classes.numeric}>
                {formatCost(row.cpuCost)}
              </TableCell>
              <TableCell className={classes.numeric}>
                {formatCost(row.memoryCost)}
              </TableCell>
              <TableCell className={classes.numeric}>
                {formatEfficiency(row.efficiency)}
              </TableCell>
              <TableCell className={classes.numeric}>
                {formatCost(row.total)}
              </TableCell>
              <TableCell className={classes.numeric}>
                <DeltaCell deltaPct={row.deltaPct} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export const CostInsightsTable: FC<CostInsightsTableProps> = props => {
  if (props.rows.length === 0) return <EmptyState />;
  // The component level shows environments with right-sizing recommendations in
  // a dedicated layout; other levels use the standard drillable cost breakdown.
  return props.level === 'component' ? (
    <RecommendationCostTable {...props} />
  ) : (
    <StandardCostTable {...props} />
  );
};
