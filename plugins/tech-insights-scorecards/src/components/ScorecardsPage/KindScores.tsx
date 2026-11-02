import { useState, type MouseEvent } from 'react';
import Box from '@material-ui/core/Box';
import ButtonBase from '@material-ui/core/ButtonBase';
import IconButton from '@material-ui/core/IconButton';
import MuiLink from '@material-ui/core/Link';
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';
import Typography from '@material-ui/core/Typography';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { Rank } from '@backstage-community/plugin-tech-insights-maturity-common';
import type { KindSummary } from '../../breakdown';
import { countOf, inSentence, pluralOf, useKindLabel } from '../../kinds';
import { isRollupKind } from '../../rollup';
import type { CheckProgress } from '../../scoring';
import { getTierColor } from '../../tierPalette';
import { ProgressRing } from '../ProgressRing';
import { RollupTable } from '../RollupTable';
import { useTierLabel } from '../useTierLabel';
import { CheckScores } from './CheckScores';

const RING_SIZE = 80;
const TIERS_HIGH_FIRST = [Rank.Gold, Rank.Silver, Rank.Bronze, Rank.Stone];

const useStyles = makeStyles(theme => ({
  row: {
    borderBottom: `1px solid ${theme.palette.divider}`,
    '&:last-child': { borderBottom: 'none' },
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(3),
    padding: theme.spacing(2),
    cursor: 'pointer',
  },
  title: {
    flex: '1 1 16rem',
    minWidth: 0,
  },
  tiers: {
    display: 'flex',
    gap: theme.spacing(1),
  },
  tierCount: {
    flexDirection: 'column',
    minWidth: 64,
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.borderRadius,
    border: '1px solid transparent',
    '&:hover': { backgroundColor: theme.palette.action.hover },
  },
}));

const stopPropagation = (event: MouseEvent) => event.stopPropagation();

/** A kind with checks of its own, so with a pass rate. */
export type ScoredKindSummary = KindSummary & { progress: CheckProgress };

export const hasOwnChecks = (
  summary: KindSummary,
): summary is ScoredKindSummary => summary.progress !== undefined;

function TierCount({
  rank,
  count,
  selected,
  description,
  onSelect,
}: {
  rank: Rank;
  count: number;
  selected: boolean;
  description: string;
  onSelect: () => void;
}) {
  const classes = useStyles();
  const theme = useTheme();
  const tierLabel = useTierLabel();
  const color = getTierColor(rank, theme);
  return (
    <ButtonBase
      className={classes.tierCount}
      disabled={count === 0}
      aria-pressed={selected}
      aria-label={description}
      style={selected ? { borderColor: color } : undefined}
      onClick={event => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <Typography variant="caption" style={{ color }}>
        {tierLabel(rank)}
      </Typography>
      <Typography
        variant="h6"
        component="span"
        style={{ color: count > 0 ? color : theme.palette.text.disabled }}
      >
        {count}
      </Typography>
    </ButtonBase>
  );
}

type View = 'items' | 'checks';

function KindRow({ summary }: { summary: ScoredKindSummary }) {
  const classes = useStyles();
  const kindLabel = useKindLabel();
  const tierLabel = useTierLabel();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('items');
  const [tier, setTier] = useState<Rank>();

  const singular = kindLabel(summary.kind);
  const plural = pluralOf(singular);
  const count = countOf(
    summary.nodes.length,
    inSentence(singular),
    inSentence(plural),
  );
  const { progress } = summary;
  const rows =
    tier === undefined
      ? summary.nodes
      : summary.nodes.filter(node => node.scored && node.rank === tier);

  function selectTier(rank: Rank) {
    if (open && view === 'items' && tier === rank) {
      setTier(undefined);
      return;
    }
    setTier(rank);
    setView('items');
    setOpen(true);
  }

  return (
    <div className={classes.row}>
      {/* The expand button is the keyboard control; the header is a larger
          target for the pointer. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div className={classes.header} onClick={() => setOpen(!open)}>
        <ProgressRing
          value={progress.percentage}
          size={RING_SIZE}
          label={`${plural}: checks passing`}
        />
        <div className={classes.title}>
          <Typography variant="h6" component="h3">
            {plural}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {progress.passedChecks} of {progress.totalChecks} checks passing ·{' '}
            {count}
          </Typography>
        </div>
        <div className={classes.tiers}>
          {TIERS_HIGH_FIRST.map(rank => (
            <TierCount
              key={rank}
              rank={rank}
              count={summary.tiers[rank]}
              selected={open && view === 'items' && tier === rank}
              description={`${countOf(
                summary.tiers[rank],
                inSentence(singular),
                inSentence(plural),
              )} at ${tierLabel(rank)}`}
              onSelect={() => selectTier(rank)}
            />
          ))}
        </div>
        <IconButton
          aria-label={`${open ? 'Collapse' : 'Expand'} ${plural}`}
          aria-expanded={open}
          onClick={event => {
            stopPropagation(event);
            setOpen(!open);
          }}
        >
          {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </div>
      {open && (
        <Box px={2} pb={2}>
          <Tabs
            value={view}
            onChange={(_, next: View) => setView(next)}
            indicatorColor="primary"
          >
            <Tab value="items" label={plural} />
            <Tab value="checks" label="Checks" />
          </Tabs>
          {view === 'items' && (
            <Box mt={1}>
              {tier !== undefined && (
                <Typography variant="body2" color="textSecondary">
                  Showing {tierLabel(tier)} only.{' '}
                  <MuiLink
                    component="button"
                    variant="body2"
                    onClick={() => setTier(undefined)}
                  >
                    Show all
                  </MuiLink>
                </Typography>
              )}
              <RollupTable
                nodes={rows}
                showKind={false}
                expandable={isRollupKind(summary.kind)}
                showTierProgress
              />
            </Box>
          )}
          {view === 'checks' && (
            <Box mt={1}>
              <CheckScores nodes={summary.nodes} itemsLabel={plural} />
            </Box>
          )}
        </Box>
      )}
    </div>
  );
}

/**
 * Scores per kind, so that kinds as different as a platform's templates and
 * its services are never added into one number. Each row has the kind's
 * pass rate, how many reached each tier, and expands to the entities and
 * checks behind them.
 */
export function KindScores({ summaries }: { summaries: ScoredKindSummary[] }) {
  return (
    <>
      {summaries.map(summary => (
        <KindRow key={summary.kind} summary={summary} />
      ))}
    </>
  );
}
