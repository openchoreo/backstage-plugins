/* eslint-disable no-nested-ternary */
import { Box, Button, Tooltip } from '@material-ui/core';
import { useDeployPermission } from '@openchoreo/backstage-plugin-react';
import { EnvironmentActionsProps } from '../types';

/**
 * Action buttons for promotion and suspension of environment deployments
 */
export const EnvironmentActions = ({
  environmentName,
  bindingName,
  deploymentStatus,
  promotionTargets,
  isAlreadyPromoted,
  promotionTracker,
  suspendTracker,
  onPromote,
  onSuspend,
}: EnvironmentActionsProps) => {
  // Check if user has permission to promote (uses deploy permission)
  const {
    canDeploy: canPromote,
    loading: promotePermissionLoading,
    deniedTooltip,
  } = useDeployPermission();

  const hasPromotionTargets =
    deploymentStatus === 'Ready' &&
    promotionTargets &&
    promotionTargets.length > 0;
  const hasMultipleTargets =
    hasPromotionTargets && promotionTargets && promotionTargets.length > 1;
  const hasSingleTarget =
    hasPromotionTargets && promotionTargets && promotionTargets.length === 1;

  // Don't render if there's nothing to show
  if (!hasPromotionTargets && !bindingName) {
    return null;
  }

  return (
    <Box mt="auto" mb={2}>
      {/* Multiple promotion targets - stack vertically */}
      {hasMultipleTargets &&
        promotionTargets!.map((target, index) => (
          <Box
            key={target.name}
            display="flex"
            justifyContent="flex-end"
            mb={index < promotionTargets!.length - 1 ? 2 : bindingName ? 2 : 0}
          >
            <Tooltip title={deniedTooltip}>
              <span>
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  disabled={
                    promotePermissionLoading ||
                    !canPromote ||
                    promotionTracker.isActive(target.name) ||
                    isAlreadyPromoted(target.name)
                  }
                  onClick={() => onPromote(target.name)}
                >
                  {isAlreadyPromoted(target.name)
                    ? `Promoted to ${target.name}`
                    : promotionTracker.isActive(target.name)
                    ? 'Promoting...'
                    : `Promote to ${target.name}`}
                  {!isAlreadyPromoted(target.name) &&
                    target.requiresApproval &&
                    !promotionTracker.isActive(target.name) &&
                    ' (Approval Required)'}
                </Button>
              </span>
            </Tooltip>
          </Box>
        ))}

      {/* Single promotion target and suspend button - show in same row */}
      {(hasSingleTarget || bindingName) && (
        <Box display="flex" flexWrap="wrap" justifyContent="flex-end">
          {/* Single promotion button */}
          {hasSingleTarget && (
            <Tooltip title={deniedTooltip}>
              <span>
                <Button
                  style={{ marginRight: '8px' }}
                  variant="contained"
                  color="primary"
                  size="small"
                  disabled={
                    promotePermissionLoading ||
                    !canPromote ||
                    promotionTracker.isActive(promotionTargets![0].name) ||
                    isAlreadyPromoted(promotionTargets![0].name)
                  }
                  onClick={() => onPromote(promotionTargets![0].name)}
                >
                  {isAlreadyPromoted(promotionTargets![0].name)
                    ? 'Promoted'
                    : promotionTracker.isActive(promotionTargets![0].name)
                    ? 'Promoting...'
                    : 'Promote'}
                  {!isAlreadyPromoted(promotionTargets![0].name) &&
                    promotionTargets![0].requiresApproval &&
                    !promotionTracker.isActive(promotionTargets![0].name) &&
                    ' (Approval Required)'}
                </Button>
              </span>
            </Tooltip>
          )}

          {/* Suspend button - show whenever there's a binding */}
          {bindingName && (
            <Button
              variant="outlined"
              color="secondary"
              size="small"
              disabled={suspendTracker.isActive(environmentName)}
              onClick={onSuspend}
            >
              {suspendTracker.isActive(environmentName)
                ? 'Suspending...'
                : 'Suspend'}
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
};
