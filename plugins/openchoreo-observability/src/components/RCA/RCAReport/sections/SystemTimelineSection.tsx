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
import { useRCAReportStyles } from '../styles';
import { FormattedText } from '../FormattedText';
import type { AIRCAAgentComponents } from '@openchoreo/backstage-plugin-common';

type TimelineEvent = AIRCAAgentComponents['schemas']['TimelineEvent'];

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

export const SystemTimelineSection = ({
  timeline,
}: SystemTimelineSectionProps) => {
  const classes = useRCAReportStyles();

  if (!timeline || timeline.length === 0) {
    return null;
  }

  return (
    <Box className={classes.timelineContainer}>
      <Timeline style={{ padding: '4px 0', margin: 0 }}>
        {timeline.map((event, idx) => (
          <TimelineItem key={idx} style={{ minHeight: 'auto' }}>
            <TimelineOppositeContent
              style={{
                maxWidth: 0,
                padding: 0,
                flex: 0,
              }}
            />
            <TimelineSeparator>
              <TimelineDot color="primary" />
              {idx < timeline.length - 1 && <TimelineConnector />}
            </TimelineSeparator>
            <TimelineContent style={{ paddingRight: 0 }}>
              <Box className={classes.timelineHeaderRow}>
                <Typography variant="caption" color="textSecondary">
                  {formatTimelineTimestamp(event.timestamp)}
                </Typography>
                {event.component_uid && (
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    style={{ marginLeft: 8 }}
                  >
                    <FormattedText text={event.component_uid} />
                  </Typography>
                )}
              </Box>
              <Typography
                component="div"
                variant="body2"
                className={classes.timelineEventText}
              >
                <FormattedText text={event.event || ''} />
              </Typography>
            </TimelineContent>
          </TimelineItem>
        ))}
      </Timeline>
    </Box>
  );
};
