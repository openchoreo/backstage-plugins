import Box from '@material-ui/core/Box';
import LinearProgress from '@material-ui/core/LinearProgress';
import Typography from '@material-ui/core/Typography';
import { InfoCard, Progress } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import { countOf, inSentence, useEntityLabel, useKindLabel } from '../../kinds';
import { LoadErrorState } from '../LoadErrorState';
import { ProgressRing } from '../ProgressRing';
import { TierChip } from '../TierChip';
import { TierLadder } from '../TierLadder';
import { useEntityScorecard } from '../useEntityScorecard';
import { useEntityTabLink } from '../useEntityTabLink';

const RING_SIZE = 72;

export interface EntityScorecardSummaryCardProps {
  title: string;
}

/**
 * An entity's tier and pass rate per category, linking to its scorecard
 * tab. For a System, Domain or Group, it combines the entity's own checks
 * with those of everything that belongs to it.
 */
export function EntityScorecardSummaryCard({
  title,
}: EntityScorecardSummaryCardProps) {
  const { entity } = useEntity();
  const { value, loading, error, retry } = useEntityScorecard(entity);
  const link = useEntityTabLink()(entity);
  const label = inSentence(useKindLabel()(entity.kind));
  const entityLabel = useEntityLabel();

  let content;
  if (loading) {
    content = <Progress />;
  } else if (error) {
    content = (
      <LoadErrorState
        title="Couldn't load scores"
        error={error}
        onRetry={retry}
      />
    );
  } else if (!value || !value.root.scored) {
    content = (
      <Typography variant="body2" color="textSecondary">
        No checks apply yet.
      </Typography>
    );
  } else {
    const { rank, progress, descendantCount, checks } = value.root;
    const { categories } = value;
    content = (
      <Box display="flex" flexDirection="column" style={{ gap: 12 }}>
        <Box display="flex" alignItems="center" style={{ gap: 16 }}>
          <ProgressRing
            value={progress.percentage}
            size={RING_SIZE}
            label="Checks passing"
          />
          <Box display="flex" flexDirection="column" style={{ gap: 4 }}>
            <Box display="flex">
              <TierChip rank={rank} emphasis="filled" />
            </Box>
            <Typography variant="body2" color="textSecondary">
              {progress.passedChecks} of {progress.totalChecks} checks passing
            </Typography>
          </Box>
        </Box>
        <TierLadder checks={checks} />
        {descendantCount > 0 && (
          <Typography variant="caption" color="textSecondary">
            Combined from this {label} and the{' '}
            {descendantCount === 1
              ? entityLabel.singular
              : countOf(
                  descendantCount,
                  entityLabel.singular,
                  entityLabel.plural,
                )}{' '}
            in it.
          </Typography>
        )}
        {categories.map(category => (
          <Box key={category.category}>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2">{category.category}</Typography>
              <Typography variant="body2" color="textSecondary">
                {category.passedChecks}/{category.totalChecks}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={category.percentage}
              aria-label={`${category.category}: ${category.percentage}% of checks passing`}
            />
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <InfoCard title={title} deepLink={{ title: 'View details', link }}>
      {content}
    </InfoCard>
  );
}
