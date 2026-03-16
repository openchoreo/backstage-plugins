import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Paper,
  Divider,
  Chip,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import BlockIcon from '@material-ui/icons/Block';
import { CHOREO_LABELS } from '@openchoreo/backstage-plugin-common';
import { useSharedStyles } from './styles';

const useStyles = makeStyles(theme => ({
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
  roleMappingsTitle: {
    fontWeight: 600,
    marginBottom: theme.spacing(1.5),
  },
  mappingTableContainer: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
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

export interface BindingDetailMapping {
  role: string;
  scope: string;
  isClusterRole?: boolean;
}

export interface BindingDetail {
  name: string;
  entitlement: { claim: string; value: string };
  effect: string;
  roleMappings: BindingDetailMapping[];
  labels?: Record<string, string>;
}

interface BindingDetailDialogProps {
  open: boolean;
  onClose: () => void;
  binding: BindingDetail | null;
  scopeLabel: string;
}

export const BindingDetailDialog = ({
  open,
  onClose,
  binding,
  scopeLabel,
}: BindingDetailDialogProps) => {
  const classes = useStyles();
  const sharedClasses = useSharedStyles();

  if (!binding) return null;

  const isSystem = binding.labels?.[CHOREO_LABELS.SYSTEM] === 'true';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle disableTypography>
        <Typography variant="h4">{scopeLabel} Role Binding Details</Typography>
      </DialogTitle>
      <DialogContent>
        <Paper variant="outlined" className={classes.summaryCard}>
          <Box className={classes.summaryHeader}>
            <Typography variant="h5" className={classes.summaryTitle}>
              Summary
            </Typography>
          </Box>

          <Box className={classes.summaryRow}>
            <Typography className={classes.summaryLabel}>Name</Typography>
            <Typography className={classes.summaryValue}>
              {binding.name}
              {isSystem && (
                <Chip
                  label="System"
                  size="small"
                  variant="outlined"
                  style={{
                    marginLeft: 8,
                    fontSize: '0.7rem',
                    height: 20,
                  }}
                />
              )}
            </Typography>
          </Box>

          <Box className={classes.summaryRow}>
            <Typography className={classes.summaryLabel}>Subject</Typography>
            <Typography className={classes.summaryValue}>
              {binding.entitlement.claim} = &quot;{binding.entitlement.value}
              &quot;
            </Typography>
          </Box>

          <Box className={classes.summaryRow}>
            <Typography className={classes.summaryLabel}>Effect</Typography>
            <Box>
              <Chip
                size="small"
                icon={
                  binding.effect === 'allow' ? (
                    <CheckCircleIcon className={classes.effectIcon} />
                  ) : (
                    <BlockIcon className={classes.effectIcon} />
                  )
                }
                label={binding.effect.toUpperCase()}
                className={`${classes.effectChip} ${
                  binding.effect === 'allow'
                    ? classes.effectAllow
                    : classes.effectDeny
                }`}
              />
            </Box>
          </Box>

          <Divider className={classes.divider} />

          <Box>
            <Typography variant="h5" className={classes.roleMappingsTitle}>
              Role Mappings ({binding.roleMappings.length})
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
              {binding.roleMappings.map((rm, idx) => (
                <Box key={idx} className={classes.mappingRow}>
                  <Box className={classes.mappingRoleColumn}>
                    <Typography variant="body2">
                      {rm.role}
                      {rm.isClusterRole && (
                        <Chip
                          label="Cluster"
                          size="small"
                          variant="outlined"
                          className={sharedClasses.clusterRoleChip}
                        />
                      )}
                    </Typography>
                  </Box>
                  <Box className={classes.mappingScopeColumn}>{rm.scope}</Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Paper>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained" color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
