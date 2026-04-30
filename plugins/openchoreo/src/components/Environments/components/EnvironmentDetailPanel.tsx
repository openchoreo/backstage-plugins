import { Box, IconButton, Typography } from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import RefreshIcon from '@material-ui/icons/Refresh';
import AllInboxOutlinedIcon from '@material-ui/icons/AllInboxOutlined';
import { StatusBadge } from '@openchoreo/backstage-design-system';
import { useEnvironmentDetailPanelStyles } from '../styles';
import { useEnvironmentStatusVariant } from '../hooks/useEnvironmentStatusVariant';
import { deriveVersionLabel } from '../utils/deriveVersionLabel';
import { EnvironmentCardContent } from './EnvironmentCardContent';
import { EnvironmentActions } from './EnvironmentActions';
import type { ActionTrackers, Environment } from '../types';

export interface EnvironmentDetailPanelProps {
  environment: Environment | null;
  isAlreadyPromoted: (targetEnvName: string) => boolean;
  actionTrackers: ActionTrackers;
  activeIncidentCount?: number;
  onClose: () => void;
  onRefresh: () => void;
  onOpenOverrides: () => void;
  onOpenReleaseDetails: () => void;
  onPromote: (targetEnvName: string) => Promise<void>;
  onSuspend: () => Promise<void>;
  onRedeploy: () => Promise<void>;
  onRolloutRestart?: () => Promise<void> | void;
}

/**
 * Right-pane detail panel for the deploy split view. Reuses the existing
 * EnvironmentCardContent + EnvironmentActions presentation while wrapping
 * them in a panel chrome (status pill, close button, version label).
 */
export const EnvironmentDetailPanel = ({
  environment,
  isAlreadyPromoted,
  actionTrackers,
  activeIncidentCount,
  onClose,
  onRefresh,
  onOpenOverrides,
  onOpenReleaseDetails,
  onPromote,
  onSuspend,
  onRedeploy,
  onRolloutRestart,
}: EnvironmentDetailPanelProps) => {
  const classes = useEnvironmentDetailPanelStyles();
  const statusVariant = useEnvironmentStatusVariant(
    environment?.deployment.status,
    environment?.deployment.statusReason,
  );

  if (!environment) {
    return (
      <Box className={classes.panel}>
        <Box className={classes.emptyState}>
          <AllInboxOutlinedIcon className={classes.emptyIcon} />
          <Typography variant="body2">
            Click an environment on the graph to see its details.
          </Typography>
        </Box>
      </Box>
    );
  }

  const versionLabel = deriveVersionLabel(environment.deployment.image);

  return (
    <Box className={classes.panel}>
      <Box className={classes.header}>
        <Box className={classes.headerTopRow}>
          <Box className={classes.headerStatusRow}>
            <StatusBadge status={statusVariant.variant} />
          </Box>
          <Box>
            <IconButton
              size="small"
              onClick={onRefresh}
              aria-label="Refresh environment"
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={onClose}
              aria-label="Close detail panel"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
        <Box>
          <Typography className={classes.envName}>
            {environment.name}
          </Typography>
          {versionLabel && (
            <Typography variant="body2" className={classes.versionLine}>
              {versionLabel}
            </Typography>
          )}
        </Box>
      </Box>
      <Box className={classes.body}>
        <EnvironmentCardContent
          status={environment.deployment.status}
          statusReason={environment.deployment.statusReason}
          statusMessage={environment.deployment.statusMessage}
          lastDeployed={environment.deployment.lastDeployed}
          image={environment.deployment.image}
          releaseName={environment.deployment.releaseName}
          endpoints={environment.endpoints}
          onOpenReleaseDetails={onOpenReleaseDetails}
          activeIncidentCount={activeIncidentCount}
          environmentName={environment.name}
        />
        <EnvironmentActions
          environmentName={environment.name}
          bindingName={environment.bindingName}
          deploymentStatus={environment.deployment.status}
          statusReason={environment.deployment.statusReason}
          promotionTargets={environment.promotionTargets}
          isAlreadyPromoted={isAlreadyPromoted}
          promotionTracker={actionTrackers.promotionTracker}
          suspendTracker={actionTrackers.suspendTracker}
          rolloutRestartTracker={actionTrackers.rolloutRestartTracker}
          onPromote={onPromote}
          onSuspend={onSuspend}
          onRedeploy={onRedeploy}
          onOpenOverrides={onOpenOverrides}
          onRolloutRestart={onRolloutRestart}
        />
      </Box>
    </Box>
  );
};
