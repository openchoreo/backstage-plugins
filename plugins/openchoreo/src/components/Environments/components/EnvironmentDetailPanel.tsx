import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  IconButton,
  Tooltip,
  Typography,
} from '@material-ui/core';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import CloseIcon from '@material-ui/icons/Close';
import CodeOutlinedIcon from '@material-ui/icons/CodeOutlined';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import DescriptionOutlinedIcon from '@material-ui/icons/DescriptionOutlined';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import RefreshIcon from '@material-ui/icons/Refresh';
import AllInboxOutlinedIcon from '@material-ui/icons/AllInboxOutlined';
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined';
import ReportProblemOutlinedIcon from '@material-ui/icons/ReportProblemOutlined';
import SettingsOutlinedIcon from '@material-ui/icons/SettingsOutlined';
import { StatusBadge } from '@openchoreo/backstage-design-system';
import { formatRelativeTime } from '@openchoreo/backstage-plugin-react';
import { useEnvironmentDetailPanelStyles } from '../styles';
import { useEnvironmentStatusVariant } from '../hooks/useEnvironmentStatusVariant';
import { NO_DRIFT, type ReleaseDriftInfo } from '../hooks/computeReleaseDrift';
import { derivePrimaryUrl } from '../utils/invokeUrlUtils';
import { EnvironmentActions } from './EnvironmentActions';
import { IncidentsBanner } from './IncidentsBanner';
import { InvokeUrlsDialog } from './InvokeUrlsDialog';
import { PromotePrimaryAction } from './PromotePrimaryAction';
import { ReleaseManifestDialog } from './ReleaseManifestDialog';
import { RemoveDeploymentConfirmationDialog } from './RemoveDeploymentConfirmationDialog';
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
  /** Drift relative to direct upstreams; defaults to no drift. */
  driftInfo?: ReleaseDriftInfo;
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
 * Right-pane detail panel for the deploy split view.
 *
 * Body is split into four labelled sections separated by horizontal
 * dividers: Release · Endpoints · Configuration · Actions. The header
 * holds only the status badge, env name, and refresh/close chrome —
 * release-name + drift live in the Release section, Promote lives in
 * the Actions section (no longer pinned in a panel footer).
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
  driftInfo = NO_DRIFT,
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
  const [manifestOpen, setManifestOpen] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [invokeUrlsOpen, setInvokeUrlsOpen] = useState(false);
  const [dangerExpanded, setDangerExpanded] = useState(false);
  const dangerAccordionRef = useRef<HTMLDivElement | null>(null);
  // Reset the danger zone to collapsed every time the user picks a
  // different env. We don't `key=` the Accordion (that would unmount /
  // remount and animate the height visibly); controlling `expanded`
  // gives the same UX without the glitch.
  useEffect(() => {
    setDangerExpanded(false);
  }, [environment?.name]);
  // When the user expands the danger zone, scroll it into view inside
  // the panel body. The body has internal `overflow-y: auto`, so the
  // scrollbar is there — the affordance just isn't always discoverable.
  // We wait for the MUI Collapse expand animation (~300ms) to finish so
  // the accordion has its full target height before we scroll.
  // `scrollIntoView` isn't defined in jsdom test environments — guard
  // so unit tests don't blow up.
  useEffect(() => {
    if (!dangerExpanded) return undefined;
    const t = window.setTimeout(() => {
      dangerAccordionRef.current?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'end',
      });
    }, 320);
    return () => window.clearTimeout(t);
  }, [dangerExpanded]);
  const statusVariant = useEnvironmentStatusVariant(
    environment?.deployment.status,
    environment?.deployment.statusReason,
  );
  const removeInFlight =
    !!environment?.bindingName &&
    !!actionTrackers.removeDeploymentTracker?.isActive(environment.bindingName);

  const primaryUrl = useMemo(
    () => (environment ? derivePrimaryUrl(environment.endpoints) : null),
    [environment],
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

  const showReleaseSection =
    !!environment.deployment.releaseName ||
    !!environment.deployment.lastDeployed ||
    driftInfo.isBehind;
  const hasEndpoints = environment.endpoints.length > 0;
  const showPromote =
    !!environment.bindingName &&
    environment.deployment.status === 'Ready' &&
    (environment.promotionTargets?.length ?? 0) > 0;
  const isActiveDeployment =
    environment.deployment.status === 'Ready' &&
    environment.deployment.statusReason !== 'ResourcesUndeployed';
  const showRolloutRestart =
    !!onRolloutRestart && !!environment.bindingName && isActiveDeployment;
  const showUndeploy = !!environment.bindingName;
  const showRemoveDeployment =
    !!onRemoveDeployment && !!environment.bindingName;
  const showActionsSection =
    showPromote || showUndeploy || showRolloutRestart || showRemoveDeployment;

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
        <Typography className={classes.envName}>{environment.name}</Typography>
      </Box>

      <Box className={classes.body}>
        {showReleaseSection && (
          <Box className={classes.section}>
            {environment.deployment.releaseName && (
              <Box className={classes.releaseNameRow}>
                <Typography
                  variant="caption"
                  className={classes.releaseNameLabel}
                >
                  Release
                </Typography>
                <Tooltip title={environment.deployment.releaseName}>
                  <Typography variant="caption" className={classes.releaseName}>
                    {environment.deployment.releaseName}
                  </Typography>
                </Tooltip>
                <Tooltip title="View release">
                  <IconButton
                    size="small"
                    aria-label="View release"
                    onClick={() => setManifestOpen(true)}
                  >
                    <CodeOutlinedIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Copy release name">
                  <IconButton
                    size="small"
                    aria-label="Copy release name"
                    onClick={() =>
                      navigator.clipboard?.writeText(
                        environment.deployment.releaseName!,
                      )
                    }
                  >
                    <FileCopyOutlinedIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
            {environment.deployment.lastDeployed && (
              <Box display="flex" alignItems="center">
                <Typography variant="body2" style={{ fontWeight: 500 }}>
                  Deployed
                </Typography>
                <AccessTimeIcon className={classes.timeIcon} />
                <Typography variant="body2" color="textSecondary">
                  {formatRelativeTime(environment.deployment.lastDeployed)}
                </Typography>
              </Box>
            )}
            {driftInfo.isBehind && (
              <Tooltip
                title={
                  <>
                    {driftInfo.aheadUpstreams.map(u => (
                      <div key={u.envName}>
                        {u.envName}
                        {u.releaseName ? ` on ${u.releaseName}` : ''}
                      </div>
                    ))}
                  </>
                }
              >
                <Box className={classes.driftRow}>
                  <ReportProblemOutlinedIcon fontSize="small" />
                  <Typography variant="caption">Behind upstream</Typography>
                </Box>
              </Tooltip>
            )}
            {activeIncidentCount !== undefined && activeIncidentCount > 0 && (
              <IncidentsBanner
                count={activeIncidentCount}
                environmentName={environment.name}
              />
            )}
            {environment.deployment.releaseName && (
              <Box>
                <Tooltip title="View Kubernetes artifacts">
                  <Button
                    variant="outlined"
                    color="primary"
                    size="small"
                    startIcon={<DescriptionOutlinedIcon fontSize="small" />}
                    onClick={onOpenReleaseDetails}
                    style={{ textTransform: 'none' }}
                  >
                    View K8s Artifacts
                  </Button>
                </Tooltip>
              </Box>
            )}
          </Box>
        )}

        {hasEndpoints && (
          <Box className={classes.section}>
            <Box className={classes.sectionTitleRow}>
              <Typography className={classes.sectionTitle}>
                Endpoints
              </Typography>
              <Button
                variant="text"
                color="primary"
                size="small"
                onClick={() => setInvokeUrlsOpen(true)}
                style={{ textTransform: 'none' }}
              >
                View All
              </Button>
            </Box>
            {primaryUrl && (
              <Box className={classes.inlineUrlRow}>
                <Typography
                  variant="caption"
                  className={classes.inlineUrlLabel}
                >
                  {primaryUrl.label}:
                </Typography>
                <Tooltip title={primaryUrl.url}>
                  <a
                    href={primaryUrl.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={classes.inlineUrl}
                  >
                    {primaryUrl.url}
                  </a>
                </Tooltip>
                <Tooltip title="Copy URL">
                  <IconButton
                    size="small"
                    aria-label="Copy URL"
                    onClick={() =>
                      navigator.clipboard?.writeText(primaryUrl.url)
                    }
                  >
                    <FileCopyOutlinedIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          </Box>
        )}

        <Box className={classes.section}>
          <Box className={classes.sectionTitleRow}>
            <Typography className={classes.sectionTitle}>
              Configuration
            </Typography>
            <Tooltip
              title={
                environment.bindingName
                  ? 'Customise environment-specific overrides for this release.'
                  : 'Deploy this environment first to configure overrides.'
              }
              placement="top"
            >
              <span>
                <Button
                  variant="outlined"
                  color="primary"
                  size="small"
                  startIcon={<SettingsOutlinedIcon fontSize="small" />}
                  disabled={!environment.bindingName}
                  onClick={onOpenOverrides}
                  style={{ textTransform: 'none' }}
                >
                  Configure overrides
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Box>

        {showActionsSection && (
          <Box className={classes.section}>
            <Typography className={classes.sectionTitle}>Actions</Typography>
            {showPromote && (
              <Box display="flex" justifyContent="flex-end">
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
            <EnvironmentActions
              environmentName={environment.name}
              bindingName={environment.bindingName}
              deploymentStatus={environment.deployment.status}
              statusReason={environment.deployment.statusReason}
              suspendTracker={actionTrackers.suspendTracker}
              rolloutRestartTracker={actionTrackers.rolloutRestartTracker}
              onSuspend={onSuspend}
              onRedeploy={onRedeploy}
              onRolloutRestart={onRolloutRestart}
            />
            {showRemoveDeployment && (
              <Accordion
                ref={dangerAccordionRef}
                expanded={dangerExpanded}
                onChange={(_, val) => setDangerExpanded(val)}
                className={classes.dangerAccordion}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  className={classes.dangerAccordionSummary}
                  aria-label="Danger zone"
                >
                  <ReportProblemOutlinedIcon
                    fontSize="small"
                    className={classes.dangerAccordionIcon}
                  />
                  <Typography
                    variant="body2"
                    className={classes.dangerAccordionTitle}
                  >
                    Danger zone
                  </Typography>
                </AccordionSummary>
                <AccordionDetails className={classes.dangerAccordionDetails}>
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    style={{ marginBottom: 8 }}
                  >
                    Remove deployment deletes the release binding,
                    environment-specific overrides, and the running Kubernetes
                    resources. This cannot be undone — to redeploy you'll need
                    to configure overrides again.
                  </Typography>
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
                </AccordionDetails>
              </Accordion>
            )}
          </Box>
        )}
      </Box>

      <InvokeUrlsDialog
        open={invokeUrlsOpen}
        onClose={() => setInvokeUrlsOpen(false)}
        endpoints={environment.endpoints}
      />

      <ReleaseManifestDialog
        open={manifestOpen}
        onClose={() => setManifestOpen(false)}
        releaseName={environment.deployment.releaseName}
        environmentName={environment.name}
      />

      <RemoveDeploymentConfirmationDialog
        open={showRemoveDialog}
        environmentName={environment.name}
        isRemoving={removeInFlight}
        onCancel={() => setShowRemoveDialog(false)}
        onConfirm={async () => {
          setShowRemoveDialog(false);
          await onRemoveDeployment?.();
        }}
      />
    </Box>
  );
};
