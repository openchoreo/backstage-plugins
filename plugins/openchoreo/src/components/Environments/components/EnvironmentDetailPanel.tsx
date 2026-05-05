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
import { PromotePrimaryAction } from './PromotePrimaryAction';
import { SetupDetailPane } from './SetupDetailPane';
import type { ActionTrackers, Environment } from '../types';

export type DetailPanelSelection =
  | { kind: 'env'; environment: Environment }
  | { kind: 'setup' }
  | null;

export interface EnvironmentDetailPanelProps {
  selection: DetailPanelSelection;
  isAlreadyPromoted: (targetEnvName: string) => boolean;
  actionTrackers: ActionTrackers;
  activeIncidentCount?: number;
  /** True when at least one env has a binding (anything deployed). */
  hasAnyDeployedEnv: boolean;
  isWorkloadEditorSupported: boolean;
  environmentsExist: boolean;
  loadingSetup: boolean;
  onConfigureWorkload: () => void;
  onClose: () => void;
  onRefresh: () => void;
  onOpenOverrides: () => void;
  onOpenReleaseDetails: () => void;
  onPromote: (targetEnvName: string) => Promise<void>;
  onSuspend: () => Promise<void>;
  onRedeploy: () => Promise<void>;
  onRolloutRestart?: () => Promise<void> | void;
  onRemoveDeployment?: () => Promise<void> | void;
}

/**
 * Right-pane detail panel for the deploy split view. Renders one of:
 *
 *   - Setup actions (Auto Deploy + Configure & Deploy) when the canvas
 *     Setup tile is selected.
 *   - The full env detail (status, content, actions) when an env tile is
 *     selected.
 *   - A contextual empty state pointing the user at Set up when nothing
 *     is selected.
 */
export const EnvironmentDetailPanel = ({
  selection,
  isAlreadyPromoted,
  actionTrackers,
  activeIncidentCount,
  hasAnyDeployedEnv,
  isWorkloadEditorSupported,
  environmentsExist,
  loadingSetup,
  onConfigureWorkload,
  onClose,
  onRefresh,
  onOpenOverrides,
  onOpenReleaseDetails,
  onPromote,
  onSuspend,
  onRedeploy,
  onRolloutRestart,
  onRemoveDeployment,
}: EnvironmentDetailPanelProps) => {
  const classes = useEnvironmentDetailPanelStyles();
  const environment = selection?.kind === 'env' ? selection.environment : null;
  const statusVariant = useEnvironmentStatusVariant(
    environment?.deployment.status,
    environment?.deployment.statusReason,
  );

  if (selection?.kind === 'setup') {
    return (
      <SetupDetailPane
        environmentsExist={environmentsExist}
        isWorkloadEditorSupported={isWorkloadEditorSupported}
        loading={loadingSetup}
        onConfigureWorkload={onConfigureWorkload}
        onClose={onClose}
      />
    );
  }

  if (!environment) {
    return (
      <Box className={classes.panel}>
        <Box className={classes.emptyState}>
          <AllInboxOutlinedIcon className={classes.emptyIcon} />
          <Typography variant="body2">
            {hasAnyDeployedEnv ? (
              <>
                Select an environment to view details, or click{' '}
                <strong>Set up</strong> to update configuration.
              </>
            ) : (
              <>
                Click <strong>Set up</strong> to configure & deploy your
                component to get started.
              </>
            )}
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
          suspendTracker={actionTrackers.suspendTracker}
          rolloutRestartTracker={actionTrackers.rolloutRestartTracker}
          removeDeploymentTracker={actionTrackers.removeDeploymentTracker}
          onSuspend={onSuspend}
          onRedeploy={onRedeploy}
          onOpenOverrides={onOpenOverrides}
          onRolloutRestart={onRolloutRestart}
          onRemoveDeployment={onRemoveDeployment}
        />
      </Box>
      {/* Dedicated bottom strip for the panel's primary action. The
          component returns null when there's nothing to promote, in
          which case we skip the footer entirely so the panel doesn't
          end with an empty divider strip. */}
      {!!environment.bindingName &&
        environment.deployment.status === 'Ready' &&
        (environment.promotionTargets?.length ?? 0) > 0 && (
          <Box className={classes.footer}>
            <PromotePrimaryAction
              environmentName={environment.name}
              bindingName={environment.bindingName}
              deploymentStatus={environment.deployment.status}
              statusReason={environment.deployment.statusReason}
              promotionTargets={environment.promotionTargets}
              isAlreadyPromoted={isAlreadyPromoted}
              promotionTracker={actionTrackers.promotionTracker}
              onPromote={onPromote}
            />
          </Box>
        )}
    </Box>
  );
};
