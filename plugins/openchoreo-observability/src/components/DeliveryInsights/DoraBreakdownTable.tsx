import {
  Box,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Progress } from '@backstage/core-components';
import { DoraClassification } from '../../types';
import { DoraBreakdownRow } from './useDoraBreakdown';
import {
  CLASSIFICATION_COLORS,
  formatDurationMs,
  formatPercent,
} from './utils';

const useStyles = makeStyles(theme => ({
  container: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 10,
  },
  nameCell: {
    fontWeight: 600,
  },
  nameLink: {
    color: theme.palette.primary.main,
  },
  sparkTrack: {
    width: 78,
    height: 7,
    borderRadius: 4,
    background: theme.palette.action.hover,
    overflow: 'hidden',
    display: 'inline-block',
    verticalAlign: 'middle',
    marginRight: 9,
  },
  sparkFill: {
    height: '100%',
    borderRadius: 4,
    background: theme.palette.primary.main,
  },
  num: {
    fontVariantNumeric: 'tabular-nums',
  },
  chip: {
    fontWeight: 600,
    height: 22,
  },
  miniDelta: {
    fontSize: 11,
    marginLeft: 8,
  },
}));

// The row's single DORA rating is its weakest metric tier — a scope is only as
// good as its worst signal (Unknowns are ignored so sparse data doesn't drag).
const TIER_ORDER: DoraClassification[] = ['Elite', 'High', 'Medium', 'Low'];
function overallRating(
  summary: DoraBreakdownRow['summary'],
): DoraClassification {
  if (!summary) {
    return 'Unknown';
  }
  const tiers = [
    summary.deploymentFrequency?.classification,
    summary.leadTime?.classification,
    summary.changeFailureRate?.classification,
    summary.mttr?.classification,
  ].filter((t): t is DoraClassification => Boolean(t) && t !== 'Unknown');
  if (tiers.length === 0) {
    return 'Unknown';
  }
  return tiers.reduce((worst, t) =>
    TIER_ORDER.indexOf(t) > TIER_ORDER.indexOf(worst) ? t : worst,
  );
}

export interface DoraBreakdownTableProps {
  /** First column header: Project | Component | Environment. */
  childLabel: string;
  rows: DoraBreakdownRow[];
  loading: boolean;
  error: string | null;
  /**
   * Called when a row backed by a catalog entity (a project or component) is
   * clicked — the caller narrows the page scope to it.
   */
  onDrill?: (childName: string) => void;
  /**
   * Called when a row without a catalog entity (an environment) is clicked —
   * the caller applies it as the environment filter.
   */
  onSelectEnvironment?: (environment: string) => void;
}

/**
 * The wireframe's per-level breakdown table: one row per child scope with
 * deployment frequency (bar), lead time p50, change failure rate, MTTR, and an
 * overall DORA rating pill. Rows drill down: project/component rows narrow the
 * page scope, environment rows apply the env filter.
 */
export const DoraBreakdownTable = ({
  childLabel,
  rows,
  loading,
  error,
  onDrill,
  onSelectEnvironment,
}: DoraBreakdownTableProps) => {
  const classes = useStyles();

  if (loading) {
    return <Progress />;
  }
  if (error) {
    return (
      <Typography variant="body2" color="error">
        {error}
      </Typography>
    );
  }
  if (rows.length === 0) {
    return (
      <Typography variant="body2" color="textSecondary">
        Nothing to break down in this scope yet.
      </Typography>
    );
  }

  const maxDeploys = Math.max(
    1,
    ...rows.map(r => r.summary?.deploymentFrequency?.total ?? 0),
  );

  return (
    <TableContainer className={classes.container}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{childLabel}</TableCell>
            <TableCell align="right">Deploy freq</TableCell>
            <TableCell align="right">Lead time (p50)</TableCell>
            <TableCell align="right">Change failure</TableCell>
            <TableCell align="right">MTTR</TableCell>
            <TableCell>DORA rating</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(row => {
            const df = row.summary?.deploymentFrequency;
            const lt = row.summary?.leadTime;
            const cfr = row.summary?.changeFailureRate;
            const mttr = row.summary?.mttr;
            const rating = overallRating(row.summary);
            const colors = CLASSIFICATION_COLORS[rating];
            const delta = df?.deltaPct ?? null;
            // Entity-backed rows (projects/components) drill the page scope
            // down a level; environment rows apply the environment filter.
            const drillable = Boolean(row.entityRef && onDrill);
            const handleClick = () => {
              if (drillable) {
                onDrill!(row.name);
              } else if (onSelectEnvironment) {
                onSelectEnvironment(row.name);
              }
            };
            const clickable = drillable || Boolean(onSelectEnvironment);
            return (
              <TableRow
                key={row.name}
                hover
                onClick={clickable ? handleClick : undefined}
                style={clickable ? { cursor: 'pointer' } : undefined}
              >
                <TableCell className={classes.nameCell}>
                  <span className={drillable ? classes.nameLink : undefined}>
                    {row.name}
                  </span>
                </TableCell>
                <TableCell align="right" className={classes.num}>
                  <Box display="inline-flex" alignItems="center">
                    <span className={classes.sparkTrack}>
                      <span
                        className={classes.sparkFill}
                        style={{
                          width: `${Math.round(
                            ((df?.total ?? 0) / maxDeploys) * 100,
                          )}%`,
                          display: 'block',
                        }}
                      />
                    </span>
                    {df ? df.total : '—'}
                  </Box>
                </TableCell>
                <TableCell align="right" className={classes.num}>
                  {formatDurationMs(lt?.p50Ms)}
                </TableCell>
                <TableCell align="right" className={classes.num}>
                  {cfr && cfr.total > 0 ? formatPercent(cfr.rate) : '—'}
                </TableCell>
                <TableCell align="right" className={classes.num}>
                  {formatDurationMs(mttr?.meanMs)}
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={rating}
                    className={classes.chip}
                    style={{
                      backgroundColor: colors.background,
                      color: colors.text,
                    }}
                  />
                  {delta !== null && delta !== 0 && (
                    <Typography
                      component="span"
                      className={classes.miniDelta}
                      style={{ color: delta > 0 ? '#1e7e34' : '#c62828' }}
                    >
                      {delta > 0 ? '+' : ''}
                      {delta.toFixed(0)}%
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
