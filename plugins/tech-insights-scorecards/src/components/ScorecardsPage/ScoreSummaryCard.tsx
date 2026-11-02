import Box from '@material-ui/core/Box';
import Link from '@material-ui/core/Link';
import Typography from '@material-ui/core/Typography';
import { InfoCard } from '@backstage/core-components';
import { catalogProgress } from '../../breakdown';
import { countOf, useEntityLabel } from '../../kinds';
import { ProgressRing } from '../ProgressRing';
import type { CatalogScores } from './useScoreResults';

const RING_SIZE = 128;

interface ScoreSummaryCardProps {
  results?: CatalogScores;
  loading: boolean;
  error?: Error;
  onViewBreakdown: () => void;
}

/**
 * Pass rate across every scored entity's published checks: a literal
 * "checks passed / checks total" percentage, not a weighted score. Each
 * entity's own results count once.
 */
export function ScoreSummaryCard({
  results,
  loading,
  error,
  onViewBreakdown,
}: ScoreSummaryCardProps) {
  const entityLabel = useEntityLabel();
  const value = results && catalogProgress(results.entities);

  return (
    <InfoCard>
      <Box display="flex" alignItems="center" style={{ gap: 24 }}>
        <ProgressRing
          value={loading || !value ? undefined : value.percentage}
          size={RING_SIZE}
          label="Checks passing"
        />
        <Box>
          <Typography variant="h6">Checks passing</Typography>
          {!loading && error && (
            <Typography variant="body2" color="error">
              {error.message}
            </Typography>
          )}
          {!loading && value && (
            <Typography variant="body1" color="textSecondary">
              {value.passedChecks} of {value.totalChecks} checks pass across{' '}
              {countOf(
                value.scoredEntities,
                entityLabel.singular,
                entityLabel.plural,
              )}
            </Typography>
          )}
          <Link component="button" variant="body2" onClick={onViewBreakdown}>
            View full breakdown &gt;
          </Link>
        </Box>
      </Box>
    </InfoCard>
  );
}
