import { useMemo } from 'react';
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import Box from '@material-ui/core/Box';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { EmptyState, InfoCard, Progress } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import type { MaturityCheckResult } from '@backstage-community/plugin-tech-insights-maturity-common';
import { countOf, inSentence, useEntityLabel, useKindLabel } from '../../kinds';
import { isRollupKind } from '../../rollup';
import { UNCATEGORIZED, compareCheckResults, rankOf } from '../../scoring';
import { LoadErrorState } from '../LoadErrorState';
import { ProgressRing } from '../ProgressRing';
import { RollupTable } from '../RollupTable';
import { TierChip } from '../TierChip';
import { TierLadder } from '../TierLadder';
import {
  useEntityScorecard,
  useFactCollectionTimes,
} from '../useEntityScorecard';
import { CheckResultItem } from './CheckResultItem';

const RING_SIZE = 96;

/**
 * Read-only scorecard for one entity: its pass rate, tier and progress
 * through the tiers, then its check results grouped by category, lowest
 * tier first within each. Check management lives on the scorecards page. A
 * System, Domain or Group also lists the entities that belong to it, each
 * expanding to its own, and its tier combines them all.
 *
 * A category with a check failing at or below the next tier after the one
 * shown at the top sorts first and starts expanded, so the list explains
 * that tier: a category showing "1/2" could be a Gold aspiration or the
 * Bronze check blocking the entity, and the sort order and per-check tier
 * chip tell them apart. When the entities in a System, Domain or Group hold
 * its tier below what its own checks reach, the header says so and the
 * rollup list beneath shows which.
 */
export function EntityScorecardContent() {
  const { entity } = useEntity();
  const { value, loading, error, retry } = useEntityScorecard(entity);
  const ownChecks = value?.root.ownChecks;
  const collectedAt = useFactCollectionTimes(entity, ownChecks);
  const label = inSentence(useKindLabel()(entity.kind));
  const entityLabel = useEntityLabel();
  const rollup = isRollupKind(entity.kind);

  const root = value?.root;
  const ownRank = ownChecks ? rankOf(ownChecks) : undefined;
  const shownRank = root?.scored ? root.rank : ownRank;

  const categoryGroups = useMemo(() => {
    if (!ownChecks || shownRank === undefined) return [];
    const groups = new Map<string, MaturityCheckResult[]>();
    ownChecks.forEach(c => {
      const category = c.check.metadata?.category || UNCATEGORIZED;
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category)!.push(c);
    });
    const maxRank = ownChecks.reduce(
      (max, c) => Math.max(max, c.check.metadata?.rank ?? 0),
      0,
    );
    const nextRank = shownRank >= maxRank ? shownRank : shownRank + 1;
    return Array.from(groups.entries())
      .map(([category, checks]) => ({
        category,
        checks: checks.sort(compareCheckResults),
        hasBlockingFailure: checks.some(
          c => !c.result && c.check.metadata?.rank <= nextRank,
        ),
      }))
      .sort(
        (a, b) => Number(b.hasBlockingFailure) - Number(a.hasBlockingFailure),
      );
  }, [ownChecks, shownRank]);

  const heldByChildren = Boolean(
    rollup &&
      root?.scored &&
      ownChecks &&
      ownChecks.length > 0 &&
      ownRank !== undefined &&
      ownRank > root.rank,
  );
  const ready = !loading && !error && root;

  return (
    <Grid container spacing={2}>
      {ready && root.scored && (
        <Grid item xs={12}>
          <InfoCard>
            <Box
              display="flex"
              alignItems="center"
              flexWrap="wrap"
              style={{ gap: 24 }}
            >
              <ProgressRing
                value={root.progress.percentage}
                size={RING_SIZE}
                label="Checks passing"
              />
              <Box
                display="flex"
                flexDirection="column"
                minWidth={0}
                style={{ gap: 8 }}
              >
                <Box display="flex">
                  <TierChip rank={root.rank} emphasis="filled" />
                </Box>
                <TierLadder checks={root.checks} />
                {root.descendantCount > 0 && (
                  <Typography variant="body2" color="textSecondary">
                    Combined from this {label} and the{' '}
                    {root.descendantCount === 1
                      ? entityLabel.singular
                      : countOf(
                          root.descendantCount,
                          entityLabel.singular,
                          entityLabel.plural,
                        )}{' '}
                    in it.
                  </Typography>
                )}
                {heldByChildren && ownRank !== undefined && (
                  <Box display="flex" alignItems="center" style={{ gap: 4 }}>
                    <Typography variant="body2" color="textSecondary">
                      Its own checks reach
                    </Typography>
                    <TierChip rank={ownRank} />
                    <Typography variant="body2" color="textSecondary">
                      but the {entityLabel.plural} in it hold the tier lower.
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </InfoCard>
        </Grid>
      )}

      {loading && (
        <Grid item xs={12}>
          <Progress />
        </Grid>
      )}
      {!!error && (
        <Grid item xs={12}>
          <LoadErrorState
            title="Couldn't load check results"
            error={error}
            onRetry={retry}
          />
        </Grid>
      )}
      {ready && !root.scored && (
        <Grid item xs={12}>
          <EmptyState
            missing="data"
            title="No checks apply yet"
            description={
              rollup
                ? `Published checks that match this ${label}, or the ${entityLabel.plural} in it, appear here once their facts have been collected.`
                : `Published checks whose filter matches this ${label}, and whose facts have been collected for it, appear here.`
            }
          />
        </Grid>
      )}
      {ready && categoryGroups.length > 0 && (
        <Grid item xs={12}>
          <InfoCard title={rollup ? `Checks on this ${label}` : 'Checks'}>
            {categoryGroups.map(({ category, checks, hasBlockingFailure }) => (
              <Accordion key={category} defaultExpanded={hasBlockingFailure}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>
                    {category} ({checks.filter(c => c.result).length}/
                    {checks.length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    {checks.map(c => (
                      <Grid item xs={12} key={c.check.id}>
                        <CheckResultItem result={c} collectedAt={collectedAt} />
                      </Grid>
                    ))}
                  </Grid>
                </AccordionDetails>
              </Accordion>
            ))}
          </InfoCard>
        </Grid>
      )}
      {ready && root.scored && root.children.length > 0 && (
        <Grid item xs={12}>
          <InfoCard
            title={`In this ${label}`}
            subheader={`Each ${entityLabel.singular}'s tier combines its own checks with those of the ${entityLabel.plural} in it. Expand a row to see them.`}
          >
            <RollupTable nodes={root.children} />
          </InfoCard>
        </Grid>
      )}
    </Grid>
  );
}
