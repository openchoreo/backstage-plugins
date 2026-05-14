import { Box, Button, Tooltip } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import PauseCircleOutlineIcon from '@material-ui/icons/PauseCircleOutline';
import PlayCircleOutlineIcon from '@material-ui/icons/PlayCircleOutline';
import { usePromotionAction } from '../hooks/usePromotionAction';
import type { ItemActionTracker } from '../types';
import { EnvironmentActionsProps } from '../types';

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
}));

// `usePromotionAction` requires promote inputs even when we only consume
// `undeployAction` here — feed it no-ops so the unused half is inert.
const noopTracker: ItemActionTracker = {
  isActive: () => false,
  withTracking: async (_id: string, fn: () => Promise<unknown>) => fn(),
} as unknown as ItemActionTracker;
const noopPromote = async () => {};
const isAlreadyPromotedNoop = () => false;

const REDEPLOY_TOOLTIP =
  'Re-create the Kubernetes resources for this environment using the existing release and overrides.';
const UNDEPLOY_TOOLTIP =
  'Tear down the running Kubernetes resources but keep the release binding and overrides — Redeploy will bring it back.';
const ROLLOUT_RESTART_TOOLTIP =
  'Restart the running pods without changing the release. Useful for picking up new secrets or recovering from a stuck rollout.';

/**
 * "Manage the running deployment" action row for the env detail panel.
 *
 *   [ Undeploy / Redeploy ] [ Rollout restart ]
 *
 * Configure overrides moved up next to the Deployed timestamp;
 * Remove deployment moved down to the danger zone accordion at the
 * panel bottom.
 */
export const EnvironmentActions = ({
  environmentName,
  environmentResourceName,
  bindingName,
  deploymentStatus,
  statusReason,
  suspendTracker,
  rolloutRestartTracker,
  canRolloutRestart = true,
  rolloutRestartDeniedTooltip = '',
  onSuspend,
  onRedeploy,
  onRolloutRestart,
}: EnvironmentActionsProps) => {
  const classes = useStyles();

  const { undeployAction } = usePromotionAction({
    environmentName,
    environmentResourceName,
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

  if (!undeployAction && !showRolloutRestart) {
    return null;
  }

  return (
    <Box className={classes.row}>
      {undeployAction && (
        <Tooltip
          title={
            undeployAction.deniedTooltip ||
            (undeployAction.kind === 'redeploy'
              ? REDEPLOY_TOOLTIP
              : UNDEPLOY_TOOLTIP)
          }
        >
          <span>
            <Button
              variant={
                undeployAction.kind === 'redeploy' ? 'contained' : 'outlined'
              }
              color={
                undeployAction.kind === 'redeploy' ? 'primary' : 'secondary'
              }
              size="small"
              startIcon={
                undeployAction.kind === 'redeploy' ? (
                  <PlayCircleOutlineIcon fontSize="small" />
                ) : (
                  <PauseCircleOutlineIcon fontSize="small" />
                )
              }
              disabled={undeployAction.disabled}
              onClick={undeployAction.onClick}
            >
              {undeployAction.label}
            </Button>
          </span>
        </Tooltip>
      )}

      {showRolloutRestart && (
        <Tooltip
          title={
            !canRolloutRestart && rolloutRestartDeniedTooltip
              ? rolloutRestartDeniedTooltip
              : ROLLOUT_RESTART_TOOLTIP
          }
        >
          <span>
            <Button
              variant="outlined"
              color="primary"
              size="small"
              startIcon={<AutorenewIcon fontSize="small" />}
              disabled={rolloutInFlight || !canRolloutRestart}
              onClick={() => onRolloutRestart?.()}
            >
              {rolloutInFlight ? 'Restarting...' : 'Rollout restart'}
            </Button>
          </span>
        </Tooltip>
      )}
    </Box>
  );
};
