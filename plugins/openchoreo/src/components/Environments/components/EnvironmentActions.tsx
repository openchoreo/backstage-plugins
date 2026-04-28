import { Box, Button, Tooltip } from '@material-ui/core';
import { usePromotionAction } from '../hooks/usePromotionAction';
import { EnvironmentActionsProps } from '../types';

/**
 * Action buttons for promotion, undeployment, and redeployment of environment deployments
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
  onPromote,
  onSuspend,
  onRedeploy,
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

  if (promotionActions.length === 0 && !undeployAction) {
    return null;
  }

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

      {/* Single promotion target and/or undeploy/redeploy in same row */}
      {(single || undeployAction) && (
        <Box display="flex" flexWrap="wrap" justifyContent="flex-end">
          {single && (
            <Tooltip title={single.deniedTooltip}>
              <span>
                <Button
                  style={{ marginRight: '8px' }}
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
      )}
    </Box>
  );
};
