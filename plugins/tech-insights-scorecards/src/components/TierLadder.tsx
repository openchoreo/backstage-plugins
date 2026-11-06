import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import { useTheme } from '@material-ui/core/styles';
import CheckIcon from '@material-ui/icons/Check';
import type { MaturityCheckResult } from '@backstage-community/plugin-tech-insights-maturity-common';
import { progressByTier, rankOf } from '../scoring';
import { getTierColor } from '../tierPalette';
import { useTierLabel } from './useTierLabel';

/**
 * Checks passing in each tier, lowest first, so it reads in the order the
 * tiers are earned: "Bronze ✓ 2/2  Silver 2/5  Gold 0/0". A tick marks a
 * tier the entity has reached, so a tier whose checks all pass gets none
 * while a lower tier still fails. The tick and the
 * count keep their width whether shown or not, so ladders stacked in a
 * table line up.
 */
export function TierLadder({ checks }: { checks: MaturityCheckResult[] }) {
  const theme = useTheme();
  const tierLabel = useTierLabel();
  const reached = rankOf(checks);
  return (
    <Box display="flex" flexWrap="wrap" style={{ columnGap: 16, rowGap: 4 }}>
      {progressByTier(checks).map(tier => {
        const complete = tier.totalChecks > 0 && tier.rank <= reached;
        return (
          <Box
            key={tier.rank}
            display="flex"
            alignItems="center"
            style={{ gap: 4 }}
          >
            <Typography
              variant="body2"
              style={{
                color: getTierColor(tier.rank, theme),
                fontWeight: 600,
              }}
            >
              {tierLabel(tier.rank)}
            </Typography>
            <CheckIcon
              fontSize="small"
              style={{
                color: getTierColor(tier.rank, theme),
                visibility: complete ? 'visible' : 'hidden',
              }}
              aria-label={complete ? 'reached' : undefined}
              aria-hidden={!complete}
            />
            <Typography
              variant="body2"
              color="textSecondary"
              style={{ minWidth: '5ch', fontVariantNumeric: 'tabular-nums' }}
            >
              {tier.passedChecks}/{tier.totalChecks}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
