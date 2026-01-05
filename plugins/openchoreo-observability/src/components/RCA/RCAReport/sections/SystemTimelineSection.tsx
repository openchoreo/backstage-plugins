import { Box, Typography } from '@material-ui/core';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineDot,
  TimelineConnector,
  TimelineContent,
  TimelineOppositeContent,
} from '@material-ui/lab';
import DescriptionOutlinedIcon from '@material-ui/icons/DescriptionOutlined';
import ShowChartIcon from '@material-ui/icons/ShowChart';
import AccountTreeIcon from '@material-ui/icons/AccountTree';
import { useRCAReportStyles } from '../styles';
import { FormattedText } from '../FormattedText';
import type { ObservabilityComponents } from '@openchoreo/backstage-plugin-common';

type TimelineEvent = ObservabilityComponents['schemas']['TimelineEvent'];

interface SystemTimelineSectionProps {
  timeline?: TimelineEvent[];
}

const formatTimelineTimestamp = (timestamp?: string): string => {
  if (!timestamp) return 'N/A';
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return timestamp;
  }
};

const iconStyle = { fontSize: '0.875rem' }; // Matches body2

const getSourceTypeIcon = (sourceType: string) => {
  switch (sourceType.toLowerCase()) {
    case 'log':
    case 'logs':
      return <DescriptionOutlinedIcon style={iconStyle} color="primary" />;
    case 'metric':
    case 'metrics':
      return <ShowChartIcon style={iconStyle} color="primary" />;
    case 'trace':
    case 'traces':
      return <AccountTreeIcon style={iconStyle} color="primary" />;
    default:
      return null;
  }
};

export const SystemTimelineSection = ({
  timeline,
}: SystemTimelineSectionProps) => {
  const classes = useRCAReportStyles();

  if (!timeline || timeline.length === 0) {
    return null;
  }

  return (
    <Box className={classes.timelineContainer}>
      <Timeline>
        {timeline.map((event, idx) => (
          <TimelineItem key={idx}>
            <TimelineOppositeContent
              style={{
                maxWidth: '1px',
                paddingLeft: '0px',
                paddingRight: '0px',
              }}
            />
            <TimelineSeparator>
              <TimelineDot color="primary" />
              {idx < timeline.length - 1 && <TimelineConnector />}
            </TimelineSeparator>
            <TimelineContent>
              <Box className={classes.timelineHeaderRow}>
                {event.source_type && getSourceTypeIcon(event.source_type)}
                <Typography variant="caption" color="textSecondary">
                  {formatTimelineTimestamp(event.timestamp)}
                </Typography>
              </Box>
              <Typography variant="body2" className={classes.timelineEventText}>
                <FormattedText text={event.description || ''} />
                {event.aggregated_count && event.aggregated_count > 1 && (
                  <> ({event.aggregated_count}x)</>
                )}
              </Typography>
            </TimelineContent>
          </TimelineItem>
        ))}
      </Timeline>
    </Box>
  );
};
