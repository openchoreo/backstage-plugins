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
import Filter1Icon from '@material-ui/icons/Filter1';
import Filter2Icon from '@material-ui/icons/Filter2';
import Filter3Icon from '@material-ui/icons/Filter3';
import Filter4Icon from '@material-ui/icons/Filter4';
import Filter5Icon from '@material-ui/icons/Filter5';
import Filter6Icon from '@material-ui/icons/Filter6';
import Filter7Icon from '@material-ui/icons/Filter7';
import Filter8Icon from '@material-ui/icons/Filter8';
import Filter9Icon from '@material-ui/icons/Filter9';
import Filter9PlusIcon from '@material-ui/icons/Filter9Plus';
import { useRCAReportStyles } from '../styles';
import type { ObservabilityComponents } from '@openchoreo/backstage-plugin-common';

const numberIcons = [
  Filter1Icon,
  Filter2Icon,
  Filter3Icon,
  Filter4Icon,
  Filter5Icon,
  Filter6Icon,
  Filter7Icon,
  Filter8Icon,
  Filter9Icon,
  Filter9PlusIcon,
];

const getNumberIcon = (num: number) => {
  const IconComponent = num <= 9 ? numberIcons[num - 1] : Filter9PlusIcon;
  return <IconComponent style={{ fontSize: '0.875rem' }} color="primary" />;
};

type InvestigationStep =
  ObservabilityComponents['schemas']['InvestigationStep'];

interface InvestigationPathSectionProps {
  investigationPath?: InvestigationStep[];
}

export const InvestigationPathSection = ({
  investigationPath,
}: InvestigationPathSectionProps) => {
  const classes = useRCAReportStyles();

  if (!investigationPath || investigationPath.length === 0) {
    return null;
  }

  return (
    <Box className={classes.timelineContainer}>
      <Timeline>
        {investigationPath.map((step, idx) => (
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
              {idx < investigationPath.length - 1 && <TimelineConnector />}
            </TimelineSeparator>
            <TimelineContent>
              <Box className={classes.timelineHeaderRow}>
                {getNumberIcon(idx + 1)}
                <Typography variant="body2" style={{ fontWeight: 600 }}>
                  {step.action}
                </Typography>
              </Box>
              {step.rationale && (
                <Typography className={classes.stepRationale}>
                  {step.rationale}
                </Typography>
              )}
              <Box className={classes.stepOutcomeBox}>
                <Typography variant="body2">{step.outcome}</Typography>
              </Box>
            </TimelineContent>
          </TimelineItem>
        ))}
      </Timeline>
    </Box>
  );
};
