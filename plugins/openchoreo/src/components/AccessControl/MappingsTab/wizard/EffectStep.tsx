import { Box, Typography, Paper } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import BlockIcon from '@material-ui/icons/Block';
import InfoIcon from '@material-ui/icons/Info';
import RadioButtonUncheckedIcon from '@material-ui/icons/RadioButtonUnchecked';
import RadioButtonCheckedIcon from '@material-ui/icons/RadioButtonChecked';
import { PolicyEffect } from '../../hooks';
import { WizardState } from './types';

const useStyles = makeStyles(theme => ({
  root: {
    minHeight: 350,
  },
  title: {
    marginBottom: theme.spacing(2),
  },
  subtitle: {
    marginBottom: theme.spacing(3),
    color: theme.palette.text.secondary,
  },
  effectCards: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(3),
  },
  effectCard: {
    padding: theme.spacing(2),
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  effectCardSelected: {
    borderWidth: 2,
  },
  effectCardAllow: {
    borderColor: theme.palette.success.main,
    backgroundColor: 'rgba(76, 175, 80, 0.08)',
  },
  effectCardDeny: {
    borderColor: theme.palette.error.main,
    backgroundColor: 'rgba(244, 67, 54, 0.08)',
  },
  radioIcon: {
    color: theme.palette.text.secondary,
  },
  radioIconSelected: {
    color: theme.palette.primary.main,
  },
  effectIcon: {
    fontSize: 28,
  },
  effectIconAllow: {
    color: theme.palette.success.main,
  },
  effectIconDeny: {
    color: theme.palette.error.main,
  },
  effectContent: {
    flex: 1,
  },
  effectTitle: {
    fontWeight: 600,
    fontSize: '1rem',
  },
  effectDescription: {
    color: theme.palette.text.secondary,
    fontSize: '0.875rem',
    marginTop: theme.spacing(0.5),
  },
  conditionsSection: {
    marginTop: theme.spacing(4),
    padding: theme.spacing(2),
    backgroundColor: theme.palette.grey[100],
    borderRadius: theme.shape.borderRadius,
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1.5),
  },
  conditionsIcon: {
    color: theme.palette.text.secondary,
    marginTop: 2,
  },
  conditionsContent: {
    flex: 1,
  },
  conditionsTitle: {
    fontWeight: 500,
    color: theme.palette.text.secondary,
  },
  conditionsText: {
    color: theme.palette.text.secondary,
    fontSize: '0.875rem',
    marginTop: theme.spacing(0.5),
  },
}));

interface EffectStepProps {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}

export const EffectStep = ({ state, onChange }: EffectStepProps) => {
  const classes = useStyles();

  const handleEffectChange = (effect: PolicyEffect) => {
    onChange({ effect });
  };

  return (
    <Box className={classes.root}>
      <Typography variant="h6" className={classes.title}>
        Should this mapping allow or deny access?
      </Typography>

      <Typography variant="body2" className={classes.subtitle}>
        Choose whether this mapping grants or restricts permissions
      </Typography>

      <Box className={classes.effectCards}>
        <Paper
          variant="outlined"
          className={`${classes.effectCard} ${
            state.effect === 'allow'
              ? `${classes.effectCardSelected} ${classes.effectCardAllow}`
              : ''
          }`}
          onClick={() => handleEffectChange('allow')}
        >
          {state.effect === 'allow' ? (
            <RadioButtonCheckedIcon className={classes.radioIconSelected} />
          ) : (
            <RadioButtonUncheckedIcon className={classes.radioIcon} />
          )}
          <CheckCircleIcon
            className={`${classes.effectIcon} ${classes.effectIconAllow}`}
          />
          <Box className={classes.effectContent}>
            <Typography className={classes.effectTitle}>ALLOW</Typography>
            <Typography className={classes.effectDescription}>
              Grant the "{state.selectedRole}" role permissions to this subject
            </Typography>
          </Box>
        </Paper>

        <Paper
          variant="outlined"
          className={`${classes.effectCard} ${
            state.effect === 'deny'
              ? `${classes.effectCardSelected} ${classes.effectCardDeny}`
              : ''
          }`}
          onClick={() => handleEffectChange('deny')}
        >
          {state.effect === 'deny' ? (
            <RadioButtonCheckedIcon className={classes.radioIconSelected} />
          ) : (
            <RadioButtonUncheckedIcon className={classes.radioIcon} />
          )}
          <BlockIcon
            className={`${classes.effectIcon} ${classes.effectIconDeny}`}
          />
          <Box className={classes.effectContent}>
            <Typography className={classes.effectTitle}>DENY</Typography>
            <Typography className={classes.effectDescription}>
              Explicitly block these permissions for this subject
            </Typography>
          </Box>
        </Paper>
      </Box>

      <Box className={classes.conditionsSection}>
        <InfoIcon className={classes.conditionsIcon} />
        <Box className={classes.conditionsContent}>
          <Typography className={classes.conditionsTitle}>
            Conditions (Coming Soon)
          </Typography>
          <Typography className={classes.conditionsText}>
            Fine-grained conditions like environment-based rules (e.g., only
            allow in production) will be available in a future release.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};
