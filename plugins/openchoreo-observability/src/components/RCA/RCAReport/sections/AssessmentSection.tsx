import { Box, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { InfoCard } from '@backstage/core-components';
import AssessmentOutlinedIcon from '@material-ui/icons/AssessmentOutlined';
import { FormattedText } from '../FormattedText';
import { useRCAReportStyles } from '../styles';
import type { AIRCAAgentComponents } from '@openchoreo/backstage-plugin-common';

type NoRootCauseIdentified =
  AIRCAAgentComponents['schemas']['NoRootCauseIdentified'];
type NoRootCauseOutcome = NoRootCauseIdentified['outcome'];

interface AssessmentSectionProps {
  noRootCauseResult: NoRootCauseIdentified;
}

const useStyles = makeStyles(theme => ({
  propertyGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  propertyRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(2),
  },
  propertyKey: {
    fontWeight: 500,
    color: theme.palette.text.secondary,
    fontSize: theme.typography.body2.fontSize,
    minWidth: 100,
    flexShrink: 0,
  },
  propertyValue: {
    color: theme.palette.text.primary,
    fontSize: theme.typography.body2.fontSize,
    wordBreak: 'break-word',
  },
  outcomeTransient: {
    color: theme.palette.warning.main,
    fontWeight: 500,
  },
  outcomeNoAnomaly: {
    color: theme.palette.success.main,
    fontWeight: 500,
  },
  outcomeInsufficientData: {
    color: theme.palette.warning.main,
    fontWeight: 500,
  },
  outcomeExternal: {
    color: theme.palette.info.main,
    fontWeight: 500,
  },
}));

const getOutcomeClass = (
  outcome: NoRootCauseOutcome,
  classes: ReturnType<typeof useStyles>,
): string => {
  switch (outcome) {
    case 'no_anomaly_detected':
      return classes.outcomeNoAnomaly;
    case 'insufficient_data':
      return classes.outcomeInsufficientData;
    case 'transient':
      return classes.outcomeTransient;
    case 'external_dependency':
      return classes.outcomeExternal;
    default:
      return '';
  }
};

const getOutcomeLabel = (outcome: NoRootCauseOutcome): string => {
  switch (outcome) {
    case 'no_anomaly_detected':
      return 'No Anomaly Detected';
    case 'insufficient_data':
      return 'Insufficient Data';
    case 'transient':
      return 'Transient Issue';
    case 'external_dependency':
      return 'External Dependency';
    default:
      return outcome;
  }
};

export const AssessmentSection = ({
  noRootCauseResult,
}: AssessmentSectionProps) => {
  const sharedClasses = useRCAReportStyles();
  const classes = useStyles();

  return (
    <Box className={sharedClasses.infoCardSpacing}>
      <InfoCard
        title={
          <span className={sharedClasses.cardTitle}>
            <AssessmentOutlinedIcon className={sharedClasses.cardTitleIcon} />
            Assessment
          </span>
        }
      >
        <Box className={classes.propertyGrid}>
          <Box className={classes.propertyRow}>
            <Typography className={classes.propertyKey}>Outcome</Typography>
            <Typography
              className={`${classes.propertyValue} ${getOutcomeClass(
                noRootCauseResult.outcome,
                classes,
              )}`}
            >
              {getOutcomeLabel(noRootCauseResult.outcome)}
            </Typography>
          </Box>
          <Box className={classes.propertyRow}>
            <Typography className={classes.propertyKey}>Explanation</Typography>
            <Typography className={classes.propertyValue}>
              <FormattedText text={noRootCauseResult.explanation} />
            </Typography>
          </Box>
        </Box>
      </InfoCard>
    </Box>
  );
};
