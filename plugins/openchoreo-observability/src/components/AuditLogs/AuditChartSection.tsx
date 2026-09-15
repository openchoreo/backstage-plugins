import { ReactNode } from 'react';
import {
  Box,
  Collapse,
  IconButton,
  Paper,
  Typography,
} from '@material-ui/core';
import BarChartIcon from '@material-ui/icons/BarChart';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { useAuditChartSectionStyles } from './styles';

export interface AuditChartSectionProps {
  expanded: boolean;
  onToggle: () => void;
  /** Rendered beside the title — the bucket width and legend, once loaded. */
  meta?: ReactNode;
  children: ReactNode;
}

/**
 * The collapsible frame around the activity chart, following the same idiom as
 * {@link GroupedSection}: a header that toggles on click, a chevron that says
 * which way it goes, and a `Collapse` for the body.
 *
 * Deliberately free of any chart import. The header stays on screen while the
 * chart is collapsed — so the reader can always see there is one — and this
 * file must not be what drags recharts into the page's initial bundle.
 *
 * `unmountOnExit` rather than a hidden body: collapsing is also what stops the
 * timeline aggregation being requested, and a mounted-but-hidden chart would
 * keep paying for it.
 */
export const AuditChartSection = ({
  expanded,
  onToggle,
  meta,
  children,
}: AuditChartSectionProps) => {
  const classes = useAuditChartSectionStyles();

  return (
    <Paper className={classes.card}>
      <Box
        className={classes.header}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={
          expanded ? 'Hide events over time' : 'Show events over time'
        }
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onToggle();
          }
        }}
      >
        {/* Collapsed, the title alone reads as a section of text. The glyph is
            what says there is a chart underneath — and it is an icon rather
            than the chart itself, so the header still costs no recharts. */}
        <BarChartIcon fontSize="small" className={classes.titleIcon} />
        <Typography variant="body2" className={classes.title}>
          Events over time
        </Typography>
        {expanded && meta}
        <span className={classes.grow} />
        <IconButton
          size="small"
          // The whole header is the control; this is its affordance, so it must
          // not announce itself as a second button to a screen reader.
          tabIndex={-1}
          aria-hidden="true"
        >
          {expanded ? (
            <ExpandLessIcon fontSize="small" />
          ) : (
            <ExpandMoreIcon fontSize="small" />
          )}
        </IconButton>
      </Box>
      <Collapse in={expanded} unmountOnExit>
        <Box className={classes.body}>{children}</Box>
      </Collapse>
    </Paper>
  );
};
