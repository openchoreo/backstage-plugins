import { FC } from 'react';
import { Box, Typography } from '@material-ui/core';
import { useWirelogsStatsStyles } from './styles';

interface WirelogsStatsProps {
  visibleCount: number;
  totalLoaded: number;
  allowed: number;
  dropped: number;
}

function getRatioClass(
  ratio: number,
  classes: ReturnType<typeof useWirelogsStatsStyles>,
): string {
  if (ratio >= 90) return classes.ratioHigh;
  if (ratio >= 70) return classes.ratioMid;
  return classes.ratioLow;
}

export const WirelogsStats: FC<WirelogsStatsProps> = ({
  visibleCount,
  totalLoaded,
  allowed,
  dropped,
}) => {
  const classes = useWirelogsStatsStyles();

  const total = allowed + dropped;
  const ratio = total > 0 ? Math.round((allowed / total) * 100) : 0;
  const ratioClass = getRatioClass(ratio, classes);
  const ratioLabel = ratio >= 70 ? 'Success' : 'Degraded';

  return (
    <Box className={classes.container}>
      <Typography variant="body2" className={classes.countLabel}>
        Showing <span>{visibleCount}</span> flows of last{' '}
        <span>{totalLoaded}</span> loaded.
      </Typography>

      <Box className={classes.metrics}>
        <Typography variant="body2" className={classes.countLabel}>
          Allowed: <span className={classes.allowed}>{allowed}</span>
        </Typography>
        <Typography variant="body2" className={classes.countLabel}>
          Dropped: <span className={classes.dropped}>{dropped}</span>
        </Typography>
        <Typography variant="body2" className={classes.countLabel}>
          Ratio:{' '}
          <span className={`${ratioClass}`}>
            {ratio}% {ratioLabel}
          </span>
        </Typography>
      </Box>
    </Box>
  );
};
