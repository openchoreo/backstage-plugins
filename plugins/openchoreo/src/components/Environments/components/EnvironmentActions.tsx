import { Box, Button, Tooltip } from '@material-ui/core';
import SettingsOutlinedIcon from '@material-ui/icons/SettingsOutlined';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import { usePromotionAction } from '../hooks/usePromotionAction';
import { EnvironmentActionsProps } from '../types';

/**
 * Action buttons for the environment detail panel: configure overrides,
 * promotion, rollout-restart (when there's an active deployment), and
 * undeploy / redeploy.
 */
export const EnvironmentActions = ({
  environmentName,
  bindingName,
  deploymentStatus,
  statusReason,
  promotionTargets,
  isAlreadyPromoted,
  promotionTracker,
  suspendTracker,
  rolloutRestartTracker,
  onPromote,
  onSuspend,
  onRedeploy,
  onOpenOverrides,
  onRolloutRestart,
}: EnvironmentActionsProps) => {
  const { promotionActions, undeployAction } = usePromotionAction({
    environmentName,
    bindingName,
    deploymentStatus,
    statusReason,
    promotionTargets,
    isAlreadyPromoted,
    promotionTracker,
    suspendTracker,
    onPromote,
    onSuspend,
    onRedeploy,
  });

  const hasMultipleTargets = promotionActions.length > 1;
  const hasSingleTarget = promotionActions.length === 1;
  const single = hasSingleTarget ? promotionActions[0] : null;

  let singleLabel: string | null = null;
  if (single) {
    if (single.isAlreadyPromoted) {
      singleLabel = 'Promoted';
    } else if (single.isPromoting) {
      singleLabel = 'Promoting...';
    } else {
      singleLabel = `Promote${
        single.target.requiresApproval ? ' (Approval Required)' : ''
      }`;
    }
  }

  const multiTargetMb = (index: number): number => {
    if (index < promotionActions.length - 1) return 2;
    return undeployAction ? 2 : 0;
  };

  const isActiveDeployment =
    deploymentStatus === 'Ready' && statusReason !== 'ResourcesUndeployed';
  const showRolloutRestart =
    !!onRolloutRestart && !!bindingName && isActiveDeployment;
  const rolloutInFlight =
    !!bindingName && !!rolloutRestartTracker?.isActive(bindingName);

  const hasAnyAction =
    promotionActions.length > 0 ||
    !!undeployAction ||
    !!onOpenOverrides ||
    showRolloutRestart;
  if (!hasAnyAction) {
    return null;
  }

  return (
    <Box mt="auto" mb={2}>
      {/* Multiple promotion targets - stack vertically */}
      {hasMultipleTargets &&
        promotionActions.map((action, index) => (
          <Box
            key={action.target.name}
            display="flex"
            justifyContent="flex-end"
            mb={multiTargetMb(index)}
          >
            <Tooltip title={action.deniedTooltip}>
              <span>
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  disabled={action.disabled}
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              </span>
            </Tooltip>
          </Box>
        ))}

      <Box display="flex" flexWrap="wrap" justifyContent="flex-end" gridGap={8}>
        {onOpenOverrides && (
          <Button
            variant="outlined"
            color="primary"
            size="small"
            startIcon={<SettingsOutlinedIcon fontSize="small" />}
            onClick={onOpenOverrides}
          >
            Configure overrides
          </Button>
        )}

        {single && (
          <Tooltip title={single.deniedTooltip}>
            <span>
              <Button
                variant="contained"
                color="primary"
                size="small"
                disabled={single.disabled}
                onClick={single.onClick}
              >
                {singleLabel}
              </Button>
            </span>
          </Tooltip>
        )}

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

        {undeployAction && (
          <Tooltip title={undeployAction.deniedTooltip}>
            <span>
              <Button
                variant={
                  undeployAction.kind === 'redeploy' ? 'contained' : 'outlined'
                }
                color={
                  undeployAction.kind === 'redeploy' ? 'primary' : 'secondary'
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
      </Box>
    </Box>
  );
};
