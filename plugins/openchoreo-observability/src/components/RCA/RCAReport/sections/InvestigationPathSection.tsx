import { useState } from 'react';
import { Box, Typography, Collapse, ButtonBase } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineDot,
  TimelineConnector,
  TimelineContent,
  TimelineOppositeContent,
} from '@material-ui/lab';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { useRCAReportStyles } from '../styles';
import { FormattedText } from '../FormattedText';
import type { ObservabilityComponents } from '@openchoreo/backstage-plugin-common';

type InvestigationStep =
  ObservabilityComponents['schemas']['InvestigationStep'];

interface InvestigationPathSectionProps {
  investigationPath?: InvestigationStep[];
}

const useStyles = makeStyles(theme => ({
  stepCard: {
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
    marginBottom: theme.spacing(0.5),
  },
  stepHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
    width: '100%',
    textAlign: 'left',
    backgroundColor: 'transparent',
    transition: 'background-color 0.15s ease',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  stepHeaderContent: {
    flex: 1,
    minWidth: 0,
  },
  stepAction: {
    fontWeight: 500,
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.primary,
    marginBottom: theme.spacing(0.25),
  },
  stepRationale: {
    fontStyle: 'italic',
    color: theme.palette.text.secondary,
    fontSize: theme.typography.caption.fontSize,
  },
  expandIcon: {
    color: theme.palette.text.secondary,
    transition: 'transform 0.2s ease',
    flexShrink: 0,
    marginTop: theme.spacing(0.25),
  },
  expandIconOpen: {
    transform: 'rotate(180deg)',
  },
  stepOutcomeContainer: {
    padding: theme.spacing(1.5),
    paddingTop: theme.spacing(1),
    borderTop: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.action.hover,
  },
  stepOutcome: {
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.primary,
  },
}));

const InvestigationStepCard = ({ step }: { step: InvestigationStep }) => {
  const classes = useStyles();
  const [expanded, setExpanded] = useState(false);

  const hasOutcome = !!step.outcome;

  return (
    <Box className={classes.stepCard}>
      <ButtonBase
        className={classes.stepHeader}
        onClick={() => hasOutcome && setExpanded(!expanded)}
        disabled={!hasOutcome}
        disableRipple
      >
        <Box className={classes.stepHeaderContent}>
          <Typography className={classes.stepAction}>
            <FormattedText text={step.action || ''} />
          </Typography>
          {step.rationale && (
            <Typography className={classes.stepRationale}>
              <FormattedText text={step.rationale} />
            </Typography>
          )}
        </Box>
        {hasOutcome && (
          <ExpandMoreIcon
            className={`${classes.expandIcon} ${
              expanded ? classes.expandIconOpen : ''
            }`}
          />
        )}
      </ButtonBase>
      {hasOutcome && (
        <Collapse in={expanded}>
          <Box className={classes.stepOutcomeContainer}>
            <Typography component="div" className={classes.stepOutcome}>
              <FormattedText text={step.outcome || ''} />
            </Typography>
          </Box>
        </Collapse>
      )}
    </Box>
  );
};

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
              <TimelineDot color="primary" className={classes.numberedDot}>
                <Typography className={classes.dotNumber}>{idx + 1}</Typography>
              </TimelineDot>
              {idx < investigationPath.length - 1 && <TimelineConnector />}
            </TimelineSeparator>
            <TimelineContent>
              <InvestigationStepCard step={step} />
            </TimelineContent>
          </TimelineItem>
        ))}
      </Timeline>
    </Box>
  );
};
