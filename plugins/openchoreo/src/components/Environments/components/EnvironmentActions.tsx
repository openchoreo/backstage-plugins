import { useState } from 'react';
import { Box, Button, Divider, Tooltip } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import SettingsOutlinedIcon from '@material-ui/icons/SettingsOutlined';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import { usePromotionAction } from '../hooks/usePromotionAction';
import type { ItemActionTracker } from '../types';
import { EnvironmentActionsProps } from '../types';
import { RemoveDeploymentConfirmationDialog } from './RemoveDeploymentConfirmationDialog';

const useStyles = makeStyles(theme => ({
  row: {
    marginTop: 'auto',
    marginBottom: theme.spacing(2),
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  group: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(0.75),
  },
  groupDivider: {
    height: 24,
    margin: theme.spacing(0, 0.25),
  },
  dangerButton: {
    color: theme.palette.error.main,
    borderColor: theme.palette.error.main,
    '&:hover': {
      borderColor: theme.palette.error.dark,
      backgroundColor: theme.palette.action.hover,
    },
  },
}));

// `usePromotionAction` requires promote inputs even when we only consume
// `undeployAction` here — feed it no-ops so the unused half is inert.
const noopTracker: ItemActionTracker = {
  isActive: () => false,
  withTracking: async (_id: string, fn: () => Promise<unknown>) => fn(),
} as unknown as ItemActionTracker;
const noopPromote = async () => {};
const isAlreadyPromotedNoop = () => false;

/**
 * Action row for the environment detail panel. Buttons are grouped by
 * intent so the row reads as: configuration · lifecycle.
 *
 *   [ Configure overrides ] | [ Rollout restart ] | [ Undeploy/Redeploy · Remove deployment ]
 *
 * Promote is the panel's primary action and lives in a dedicated footer
 * (PromotePrimaryAction) — not in this row.
 */
export const EnvironmentActions = ({
  environmentName,
  bindingName,
  deploymentStatus,
  statusReason,
  suspendTracker,
  rolloutRestartTracker,
  removeDeploymentTracker,
  onSuspend,
  onRedeploy,
  onOpenOverrides,
  onRolloutRestart,
  onRemoveDeployment,
}: EnvironmentActionsProps) => {
  const classes = useStyles();
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  const { undeployAction } = usePromotionAction({
    environmentName,
    bindingName,
    deploymentStatus,
    statusReason,
    promotionTargets: undefined,
    isAlreadyPromoted: isAlreadyPromotedNoop,
    promotionTracker: noopTracker,
    suspendTracker,
    onPromote: noopPromote,
    onSuspend,
    onRedeploy,
  });

  const isActiveDeployment =
    deploymentStatus === 'Ready' && statusReason !== 'ResourcesUndeployed';
  const showRolloutRestart =
    !!onRolloutRestart && !!bindingName && isActiveDeployment;
  const rolloutInFlight =
    !!bindingName && !!rolloutRestartTracker?.isActive(bindingName);

  // Configure overrides is gated on the env having an existing release
  // binding. Without a binding there's nothing to override yet — direct
  // the user to deploy first.
  const overridesDisabled = !bindingName;
  const overridesTooltip = overridesDisabled
    ? 'Deploy this environment first to configure overrides.'
    : '';

  const showRemoveDeployment = !!onRemoveDeployment && !!bindingName;
  const removeInFlight =
    !!bindingName && !!removeDeploymentTracker?.isActive(bindingName);

  const hasConfigGroup = !!onOpenOverrides;
  const hasDeploymentGroup = showRolloutRestart;
  const hasLifecycleGroup = !!undeployAction || showRemoveDeployment;
  const hasAnyAction =
    hasConfigGroup || hasDeploymentGroup || hasLifecycleGroup;
  if (!hasAnyAction) {
    return null;
  }

  return (
    <>
      <Box className={classes.row}>
        {/* Group 1 — configuration */}
        {hasConfigGroup && (
          <Box className={classes.group}>
            <Tooltip title={overridesTooltip} placement="top">
              <span>
                <Button
                  variant="outlined"
                  color="primary"
                  size="small"
                  startIcon={<SettingsOutlinedIcon fontSize="small" />}
                  disabled={overridesDisabled}
                  onClick={onOpenOverrides}
                >
                  Configure overrides
                </Button>
              </span>
            </Tooltip>
          </Box>
        )}

        {hasConfigGroup && hasDeploymentGroup && (
          <Divider
            orientation="vertical"
            flexItem
            className={classes.groupDivider}
          />
        )}

        {/* Group 2 — manage the running deployment */}
        {hasDeploymentGroup && (
          <Box className={classes.group}>
            {showRolloutRestart && (
              <Button
                variant="outlined"
                color="primary"
                size="small"
                startIcon={<AutorenewIcon fontSize="small" />}
                disabled={rolloutInFlight}
                onClick={() => onRolloutRestart?.()}
              >
                {rolloutInFlight ? 'Restarting...' : 'Rollout restart'}
              </Button>
            )}
          </Box>
        )}

        {hasLifecycleGroup && (hasConfigGroup || hasDeploymentGroup) && (
          <Divider
            orientation="vertical"
            flexItem
            className={classes.groupDivider}
          />
        )}

        {/* Group 3 — lifecycle (undeploy/redeploy + remove) */}
        {hasLifecycleGroup && (
          <Box className={classes.group}>
            {undeployAction && (
              <Tooltip title={undeployAction.deniedTooltip}>
                <span>
                  <Button
                    variant={
                      undeployAction.kind === 'redeploy'
                        ? 'contained'
                        : 'outlined'
                    }
                    color={
                      undeployAction.kind === 'redeploy'
                        ? 'primary'
                        : 'secondary'
                    }
                    size="small"
                    disabled={undeployAction.disabled}
                    onClick={undeployAction.onClick}
                  >
                    {undeployAction.label}
                  </Button>
                </span>
              </Tooltip>
            )}

            {showRemoveDeployment && (
              <Button
                variant="outlined"
                size="small"
                className={classes.dangerButton}
                startIcon={<DeleteOutlineIcon fontSize="small" />}
                disabled={removeInFlight}
                onClick={() => setShowRemoveDialog(true)}
              >
                {removeInFlight ? 'Removing...' : 'Remove deployment'}
              </Button>
            )}
          </Box>
        )}
      </Box>

      <RemoveDeploymentConfirmationDialog
        open={showRemoveDialog}
        environmentName={environmentName}
        isRemoving={removeInFlight}
        onCancel={() => setShowRemoveDialog(false)}
        onConfirm={async () => {
          setShowRemoveDialog(false);
          await onRemoveDeployment?.();
        }}
      />
    </>
  );
};
