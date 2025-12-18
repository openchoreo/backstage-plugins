import { Box, Typography, Paper, Divider, Chip } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import BlockIcon from '@material-ui/icons/Block';
import { WizardStepProps } from './types';

const useStyles = makeStyles(theme => ({
  root: {
    minHeight: 350,
  },
  title: {
    marginBottom: theme.spacing(2),
  },
  summaryCard: {
    padding: theme.spacing(3),
    backgroundColor: theme.palette.background.default,
  },
  summaryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
  summaryTitle: {
    fontWeight: 600,
  },
  summaryRow: {
    display: 'flex',
    padding: theme.spacing(1.5, 0),
  },
  summaryLabel: {
    width: 100,
    fontWeight: 500,
    color: theme.palette.text.secondary,
    flexShrink: 0,
  },
  summaryValue: {
    flex: 1,
    fontWeight: 500,
  },
  divider: {
    margin: theme.spacing(2, 0),
  },
  explanationSection: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(2),
    backgroundColor: theme.palette.grey[50],
    borderRadius: theme.shape.borderRadius,
    borderLeft: `4px solid ${theme.palette.primary.main}`,
  },
  explanationText: {
    lineHeight: 1.6,
  },
  effectChip: {
    fontWeight: 600,
  },
  effectAllow: {
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.dark,
  },
  effectDeny: {
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.dark,
  },
  effectIcon: {
    fontSize: 16,
  },
}));

export const ReviewStep = ({ state, userTypes }: WizardStepProps) => {
  const classes = useStyles();

  const selectedUserTypeInfo = userTypes.find(
    ut => ut.type === state.subjectType,
  );
  const entitlementClaim = selectedUserTypeInfo?.entitlement.name || '';

  const getScopePath = (): string => {
    if (state.scopeType === 'global') {
      return 'Global (all resources)';
    }

    const parts: string[] = [];
    if (state.organization) parts.push(state.organization);
    if (state.project) parts.push(state.project);
    if (state.component) {
      parts.push(state.component);
    } else if (state.project) {
      parts.push('*');
    }

    return parts.join(' / ') || 'Global';
  };

  const getSubjectDescription = (): string => {
    const typeName = selectedUserTypeInfo?.display_name || state.subjectType;
    return `${typeName} (${entitlementClaim} = "${state.entitlementValue}")`;
  };

  const getExplanation = (): string => {
    const action = state.effect === 'allow' ? 'Allow' : 'Deny';
    const subject = state.subjectType === 'user' ? 'users' : 'services';

    const getScopeDesc = (): string => {
      if (state.scopeType === 'global') return 'all resources';
      if (state.component) return `the "${state.component}" component`;
      if (state.project)
        return `all components in the "${state.project}" project`;
      return `all resources in "${state.organization}"`;
    };

    return `${action} ${subject} with ${entitlementClaim}="${
      state.entitlementValue
    }" to perform ${state.selectedRole} actions on ${getScopeDesc()}.`;
  };

  return (
    <Box className={classes.root}>
      <Typography variant="h6" className={classes.title}>
        Review your role mapping
      </Typography>

      <Paper variant="outlined" className={classes.summaryCard}>
        <Box className={classes.summaryHeader}>
          <Typography variant="h6" className={classes.summaryTitle}>
            Summary
          </Typography>
        </Box>

        <Box className={classes.summaryRow}>
          <Typography className={classes.summaryLabel}>Role</Typography>
          <Typography className={classes.summaryValue}>
            {state.selectedRole}
          </Typography>
        </Box>

        <Box className={classes.summaryRow}>
          <Typography className={classes.summaryLabel}>Subject</Typography>
          <Typography className={classes.summaryValue}>
            {getSubjectDescription()}
          </Typography>
        </Box>

        <Box className={classes.summaryRow}>
          <Typography className={classes.summaryLabel}>Scope</Typography>
          <Typography className={classes.summaryValue}>
            {getScopePath()}
          </Typography>
        </Box>

        <Box className={classes.summaryRow}>
          <Typography className={classes.summaryLabel}>Effect</Typography>
          <Box>
            <Chip
              size="small"
              icon={
                state.effect === 'allow' ? (
                  <CheckCircleIcon className={classes.effectIcon} />
                ) : (
                  <BlockIcon className={classes.effectIcon} />
                )
              }
              label={state.effect.toUpperCase()}
              className={`${classes.effectChip} ${
                state.effect === 'allow'
                  ? classes.effectAllow
                  : classes.effectDeny
              }`}
            />
          </Box>
        </Box>

        <Divider className={classes.divider} />

        <Box className={classes.explanationSection}>
          <Typography variant="subtitle2" gutterBottom>
            This mapping will:
          </Typography>
          <Typography className={classes.explanationText}>
            {getExplanation()}
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};
