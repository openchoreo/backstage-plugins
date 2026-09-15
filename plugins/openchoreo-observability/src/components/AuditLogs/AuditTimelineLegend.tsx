import { Box, Typography } from '@material-ui/core';
import { useAuditTimelineStyles, useResultColor } from './styles';
import { AUDIT_RESULTS } from './types';

export interface AuditTimelineLegendProps {
  /** The bucket width the server actually used, once a timeline has arrived. */
  interval?: string;
}

/**
 * The chart's key and bucket width, shown in the section header.
 *
 * Kept apart from {@link AuditTimeline} so the header can render without
 * pulling recharts into the bundle — the chart is lazy, this is not.
 */
export const AuditTimelineLegend = ({ interval }: AuditTimelineLegendProps) => {
  const classes = useAuditTimelineStyles();
  const colors = useResultColor();

  return (
    <>
      {interval && (
        <Typography variant="caption" className={classes.sub}>
          {interval} buckets
        </Typography>
      )}
      <Box className={classes.legend}>
        {AUDIT_RESULTS.map(result => (
          <span key={result.id} className={classes.legendItem}>
            <span
              className={classes.legendSwatch}
              style={{ backgroundColor: colors[result.id] }}
              aria-hidden="true"
            />
            {result.label}
          </span>
        ))}
      </Box>
    </>
  );
};
