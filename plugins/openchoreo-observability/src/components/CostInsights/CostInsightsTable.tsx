import { FC, useMemo, useState } from 'react';
import {
  Link,
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
import type { CostRow, CostScopeLevel } from './types';
import { formatCost, formatEfficiency, formatDelta } from './format';

const useStyles = makeStyles(theme => ({
  numeric: { textAlign: 'right', whiteSpace: 'nowrap' },
  up: { color: theme.palette.error.main },
  down: { color: theme.palette.success.main },
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
}

export const CostInsightsTable: FC<CostInsightsTableProps> = ({
  level,
  rows,
  onDrill,
  icon: KindIcon,
  titles,
}) => {
  const classes = useStyles();

  // Default sort: highest total cost first (like the catalog's default sort on
  // Created). Clicking a header toggles asc/desc; the active column shows the
  // arrow, and hovering any header reveals it.
  const [orderBy, setOrderBy] = useState<SortId>('total');
  const [order, setOrder] = useState<SortOrder>('desc');

  const onSort = (id: SortId) => {
    if (orderBy === id) {
      setOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrderBy(id);
      // Names read naturally ascending; costs are most useful highest-first.
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
      // Unknown values (null deltas / efficiency) always sort last.
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return factor * (av - bv);
    });
  }, [rows, titles, order, orderBy]);

  if (rows.length === 0) {
    return (
      <Paper variant="outlined">
        <Typography className={classes.empty} color="textSecondary">
          No cost data for the selected scope, environments and time range.
        </Typography>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" aria-label="Cost insights">
        <TableHead>
          <TableRow>
            <TableCell sortDirection={orderBy === 'name' ? order : false}>
              <TableSortLabel
                active={orderBy === 'name'}
                direction={orderBy === 'name' ? order : 'asc'}
                onClick={() => onSort('name')}
              >
                {dimensionHeader(level)}
              </TableSortLabel>
            </TableCell>
            <TableCell
              className={classes.numeric}
              sortDirection={orderBy === 'cpuCost' ? order : false}
            >
              <TableSortLabel
                active={orderBy === 'cpuCost'}
                direction={orderBy === 'cpuCost' ? order : 'asc'}
                onClick={() => onSort('cpuCost')}
              >
                CPU (USD)
              </TableSortLabel>
            </TableCell>
            <TableCell
              className={classes.numeric}
              sortDirection={orderBy === 'memoryCost' ? order : false}
            >
              <TableSortLabel
                active={orderBy === 'memoryCost'}
                direction={orderBy === 'memoryCost' ? order : 'asc'}
                onClick={() => onSort('memoryCost')}
              >
                Memory (USD)
              </TableSortLabel>
            </TableCell>
            <TableCell
              className={classes.numeric}
              sortDirection={orderBy === 'efficiency' ? order : false}
            >
              <TableSortLabel
                active={orderBy === 'efficiency'}
                direction={orderBy === 'efficiency' ? order : 'asc'}
                onClick={() => onSort('efficiency')}
              >
                Efficiency
              </TableSortLabel>
            </TableCell>
            <TableCell
              className={classes.numeric}
              sortDirection={orderBy === 'total' ? order : false}
            >
              <TableSortLabel
                active={orderBy === 'total'}
                direction={orderBy === 'total' ? order : 'asc'}
                onClick={() => onSort('total')}
              >
                Total (USD)
              </TableSortLabel>
            </TableCell>
            <TableCell
              className={classes.numeric}
              sortDirection={orderBy === 'deltaPct' ? order : false}
            >
              <TableSortLabel
                active={orderBy === 'deltaPct'}
                direction={orderBy === 'deltaPct' ? order : 'asc'}
                onClick={() => onSort('deltaPct')}
              >
                Inc/dec vs prev window
              </TableSortLabel>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedRows.map(({ row, display }) => {
            return (
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
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
