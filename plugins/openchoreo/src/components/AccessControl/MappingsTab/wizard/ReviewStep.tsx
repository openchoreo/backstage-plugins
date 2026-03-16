import { Box, Typography, Paper, Divider, Chip } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import BlockIcon from '@material-ui/icons/Block';
import { NotificationBanner } from '@openchoreo/backstage-plugin-react';
import { WizardStepProps, WizardRoleMapping } from './types';
import { getEntitlementClaim } from '../../hooks';
import { BindingType } from '../MappingDialog';
import { SCOPE_CLUSTER, SCOPE_NAMESPACE } from '../../constants';
import { useSharedStyles } from '../styles';

const useStyles = makeStyles(theme => ({
  root: {
    minHeight: 350,
    marginTop: theme.spacing(2),
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
    width: 120,
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
  roleMappingsSection: {
    marginTop: theme.spacing(1),
  },
  roleMappingsTitle: {
    fontWeight: 600,
    marginBottom: theme.spacing(1.5),
  },
  mappingRow: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(1.5, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.common.white,
    '&:last-child': {
      borderBottom: 'none',
    },
  },
  mappingRoleColumn: {
    flex: '0 0 40%',
    fontWeight: 500,
  },
  mappingScopeColumn: {
    flex: '0 0 60%',
    fontFamily: 'monospace',
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
  },
  mappingTableHeader: {
    display: 'flex',
    padding: theme.spacing(1, 2),
    borderBottom: `2px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  },
  mappingHeaderLabel: {
    fontWeight: 600,
    color: theme.palette.text.secondary,
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  mappingTableContainer: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
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
  bannerSection: {
    marginTop: theme.spacing(2),
  },
}));

interface ReviewStepProps extends WizardStepProps {
  bindingType?: BindingType;
  namespace?: string;
}

/** Build scope path matching RoleMappingsStep format */
function buildScopePath(
  rm: WizardRoleMapping,
  bindingType?: BindingType,
  namespace?: string,
): string {
  if (bindingType === SCOPE_CLUSTER) {
    if (!rm.namespace && !rm.project && !rm.component) return 'cluster:*';
    const parts: string[] = [];
    if (rm.namespace) {
      parts.push(`ns:${rm.namespace}`);
      if (rm.project) {
        parts.push(`proj:${rm.project}`);
        if (rm.component) {
          parts.push(`comp:${rm.component}`);
        } else {
          parts.push('*');
        }
      } else {
        parts.push('*');
      }
    }
    return parts.join('/');
  }
  const ns = namespace || '*';
  if (!rm.project && !rm.component) return `ns:${ns}/*`;
  const parts: string[] = [`ns:${ns}`];
  if (rm.project) {
    parts.push(`proj:${rm.project}`);
    if (rm.component) {
      parts.push(`comp:${rm.component}`);
    } else {
      parts.push('*');
    }
  }
  return parts.join('/');
}

export const ReviewStep = ({
  state,
  userTypes,
  bindingType,
  namespace,
}: ReviewStepProps) => {
  const classes = useStyles();
  const sharedClasses = useSharedStyles();

  const selectedUserTypeInfo = userTypes.find(
    ut => ut.type === state.subjectType,
  );
  const entitlementClaim = getEntitlementClaim(selectedUserTypeInfo);

  const getSubjectDescription = (): string => {
    const typeName = selectedUserTypeInfo?.displayName || state.subjectType;
    return `${typeName} (${entitlementClaim} = "${state.entitlementValue}")`;
  };

  return (
    <Box className={classes.root}>
      <Typography variant="h5" className={classes.title}>
        Review your role binding
      </Typography>

      <Paper variant="outlined" className={classes.summaryCard}>
        <Box className={classes.summaryHeader}>
          <Typography variant="h5" className={classes.summaryTitle}>
            Summary
          </Typography>
        </Box>

        <Box className={classes.summaryRow}>
          <Typography className={classes.summaryLabel}>Name</Typography>
          <Typography className={classes.summaryValue}>
            {state.name ||
              `${
                state.roleMappings[0]?.role || 'binding'
              }-${state.entitlementValue.trim()}`.toLowerCase()}
          </Typography>
        </Box>

        <Box className={classes.summaryRow}>
          <Typography className={classes.summaryLabel}>Subject</Typography>
          <Typography className={classes.summaryValue}>
            {getSubjectDescription()}
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

        <Box className={classes.roleMappingsSection}>
          <Typography variant="h5" className={classes.roleMappingsTitle}>
            Role Mappings ({state.roleMappings.length})
          </Typography>
          <Box className={classes.mappingTableContainer}>
            <Box className={classes.mappingTableHeader}>
              <Box className={classes.mappingRoleColumn}>
                <Typography className={classes.mappingHeaderLabel}>
                  Role
                </Typography>
              </Box>
              <Box className={classes.mappingScopeColumn}>
                <Typography className={classes.mappingHeaderLabel}>
                  Scope
                </Typography>
              </Box>
            </Box>
            {state.roleMappings.map((rm, idx) => (
              <Box key={idx} className={classes.mappingRow}>
                <Box className={classes.mappingRoleColumn}>
                  <Typography variant="body2">
                    {rm.role}
                    {bindingType === SCOPE_NAMESPACE &&
                      !rm.roleNamespace &&
                      rm.role && (
                        <Chip
                          label="Cluster"
                          size="small"
                          variant="outlined"
                          className={sharedClasses.clusterRoleChip}
                        />
                      )}
                  </Typography>
                </Box>
                <Box className={classes.mappingScopeColumn}>
                  {buildScopePath(rm, bindingType, namespace)}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Paper>

      <Box className={classes.bannerSection}>
        <NotificationBanner
          variant="info"
          showIcon
          message={
            <Typography>
              This mapping will{' '}
              <strong>{state.effect === 'allow' ? 'allow' : 'deny'}</strong>{' '}
              {state.subjectType === 'user' ? 'users' : 'services'} with{' '}
              <strong>
                {entitlementClaim}=&quot;{state.entitlementValue}&quot;
              </strong>{' '}
              to perform actions defined by the above role mappings.
            </Typography>
          }
        />
      </Box>
    </Box>
  );
};
