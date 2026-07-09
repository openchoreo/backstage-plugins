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
import { useTheme } from '@material-ui/core/styles';
import CloseIcon from '@material-ui/icons/Close';
import CloudIcon from '@material-ui/icons/Cloud';
import CodeOutlinedIcon from '@material-ui/icons/CodeOutlined';
import CompareArrowsIcon from '@material-ui/icons/CompareArrows';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import DescriptionOutlinedIcon from '@material-ui/icons/DescriptionOutlined';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import RefreshIcon from '@material-ui/icons/Refresh';
import AllInboxOutlinedIcon from '@material-ui/icons/AllInboxOutlined';
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import ReportProblemOutlinedIcon from '@material-ui/icons/ReportProblemOutlined';
import SettingsOutlinedIcon from '@material-ui/icons/SettingsOutlined';
import { StatusBadge } from '@openchoreo/backstage-design-system';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  formatRelativeTime,
  useReleaseBindingUpdatePermission,
  useReleaseBindingViewPermission,
  useRemoveDeploymentPermission,
} from '@openchoreo/backstage-plugin-react';
import { useEnvironmentDetailPanelStyles } from '../styles';
import { useEnvironmentStatusVariant } from '../hooks/useEnvironmentStatusVariant';
import { NO_DRIFT, type ReleaseDriftInfo } from '../hooks/computeReleaseDrift';
import { useReleases } from '../hooks/useReleases';
import { useEnvironmentsContext } from '../EnvironmentsContext';
import { derivePrimaryUrl } from '../utils/invokeUrlUtils';
import { ComponentReleaseDiffDialog } from './ComponentReleaseDiffDialog';
import { EnvironmentActions } from './EnvironmentActions';
import { IncidentsBanner } from './IncidentsBanner';
import { DeploymentFailureBanner } from './DeploymentFailureBanner';
import { InvokeUrlsDialog } from './InvokeUrlsDialog';
import { PromotePrimaryAction } from './PromotePrimaryAction';
import { ProjectNotDeployedCallout } from './ProjectNotDeployedCallout';
import { ReleaseBrowserDialog } from './ReleaseBrowserDialog';
import { ReleaseManifestDialog } from './ReleaseManifestDialog';
import type { ReleaseDeployments } from './releaseFormatters';
import { RemoveDeploymentConfirmationDialog } from './RemoveDeploymentConfirmationDialog';
import { SetupDetailPane } from './SetupDetailPane';
import {
  attributeToProjectNotDeployed,
  makeIsTargetProjectBlocked,
} from '../utils/projectDeployment';
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
  const theme = useTheme();
  const environment = selection?.kind === 'env' ? selection.environment : null;
  // ABAC env-aware permission checks. Resource name (not display name) is
  // what the cluster's CEL expressions match against.
  const envResourceName = environment?.resourceName ?? environment?.name;
  // Configure overrides / Undeploy / Redeploy / Rollout restart all mutate
  // an existing release binding — they share releasebinding:update.
  const {
    canUpdate: canModifyBinding,
    deniedTooltip: modifyBindingDeniedTooltip,
  } = useReleaseBindingUpdatePermission(envResourceName);
  // Remove deployment deletes the binding — releasebinding:delete.
  const { canRemoveDeployment, deniedTooltip: removeDeploymentDeniedTooltip } =
    useRemoveDeploymentPermission(envResourceName);
  // Per-env view permission. When denied, the detail panel header still
  // renders but the body (status / endpoints / config / actions / danger
  // zone) is replaced with a compact "No permissions" placeholder. The
  // mini-card mirrors this state — see MiniEnvironmentNode.
  const {
    canViewBinding,
    loading: viewPermissionLoading,
    deniedTooltip: viewDeniedTooltip,
  } = useReleaseBindingViewPermission(envResourceName);
  const [manifestOpen, setManifestOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const { entity } = useEntity();
  const { environments, renderInvestigateAction } = useEnvironmentsContext();
  // A promote target whose project is not deployed there blocks the promote.
  const isTargetProjectBlocked = useMemo(
    () => makeIsTargetProjectBlocked(environments),
    [environments],
  );
  const { releases, loading: releasesLoading } = useReleases(entity);
  const deployments: ReleaseDeployments = useMemo(() => {
    const map: ReleaseDeployments = {};
    for (const env of environments) {
      const name = env.deployment?.releaseName;
      if (!name) continue;
      if (!map[name]) map[name] = [];
      map[name].push(env.name);
    }
    return map;
  }, [environments]);
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

  // Per-env render/apply failure: the binding exists but the controller marked
  // it Ready=False (BFF-derived `status: 'Failed'`). Surface the controller's
  // message instead of a bare red badge — preferring the derived
  // `statusMessage`, falling back to the Ready condition message. The message
  // is optional: a reason-only failure still renders (DeploymentFailureBanner
  // shows a generic headline + reason), so we don't drop back to a context-less
  // badge. Component-level failures (no binding) are NOT shown here — they live
  // on the Setup card only, so a binding-less env reads a plain "Not Deployed".
  const isBindingFailed =
    !!environment && environment.deployment.status === 'Failed';
  const bindingFailureMessage = (() => {
    if (!isBindingFailed) return undefined;
    if (environment!.deployment.statusMessage) {
      return environment!.deployment.statusMessage;
    }
    const ready = environment!.deployment.conditions?.find(
      c => c.type === 'Ready',
    );
    return ready?.message;
  })();

  // When the failure is the component's project not being deployed in this
  // env (namespace missing), attribute it so the banner/dialog explain the
  // real cause and offer to deploy the project.
  const projectNotDeployedFailure =
    isBindingFailed &&
    !!environment &&
    attributeToProjectNotDeployed(environment);

  const failureBanner = isBindingFailed
    ? {
        message: bindingFailureMessage,
        reason: environment!.deployment.statusReason,
      }
    : null;
  // Mirror the badge colour on the View K8s Artifacts button so it stops
  // signalling "healthy" when the env isn't. Stays enabled because the
  // artifacts are exactly what users need to inspect during a failure.
  // `undeployed` is a deliberate teardown, not a warning — match the badge's
  // neutral grey rather than amber.
  const artifactsButtonColor = (() => {
    switch (statusVariant.variant) {
      case 'failed':
        return theme.palette.error.main;
      case 'pending':
        return theme.palette.warning.main;
      case 'undeployed':
        return theme.palette.text.secondary;
      default:
        return theme.palette.primary.main;
    }
  })();
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
          <Box className={classes.headerNameRow}>
            <CloudIcon
              className={classes.headerKindIcon}
              fontSize="small"
              aria-hidden
            />
            <Typography className={classes.envName}>
              {environment.name}
            </Typography>
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
        <Box className={classes.headerStatusRow}>
          <StatusBadge status={statusVariant.variant} />
          {/* Offer an AI investigation when the environment is in a problem
              state (pending or failed), pushed to the right of the status
              row. The actual button is injected by the host app via
              `renderInvestigateAction` (so this plugin keeps no
              portal-assistant dependency). Route to the dependency_pending
              flow when the cause is an unresolved connection; otherwise the
              generic runtime_debug flow so a failed deploy isn't framed as
              "stuck pending". */}
          {renderInvestigateAction &&
            (statusVariant.variant === 'pending' ||
              statusVariant.variant === 'failed') && (
              <Box ml="auto">
                {renderInvestigateAction({
                  namespace:
                    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE],
                  project:
                    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT],
                  component: entity.metadata.name,
                  environment: environment.resourceName ?? environment.name,
                  caseType:
                    environment.deployment.statusReason === 'ConnectionsPending'
                      ? 'dependency_pending'
                      : 'runtime_debug',
                  status: statusVariant.label,
                })}
              </Box>
            )}
        </Box>
      </Box>

      <Box className={classes.body}>
        {!canViewBinding && !viewPermissionLoading ? (
          <Box className={classes.section}>
            <Typography
              variant="body2"
              color="textSecondary"
              style={{ fontStyle: 'italic' }}
            >
              {viewDeniedTooltip || 'No permissions to view this environment.'}
            </Typography>
          </Box>
        ) : (
          <>
            {failureBanner && (
              <Box className={classes.section}>
                <DeploymentFailureBanner
                  message={failureBanner.message}
                  reason={failureBanner.reason}
                  projectNotDeployed={projectNotDeployedFailure}
                  envName={environment.name}
                  envResourceName={environment.resourceName}
                />
                {projectNotDeployedFailure && (
                  <Box mt={1}>
                    <ProjectNotDeployedCallout
                      variant="error-dialog"
                      envName={environment.name}
                      envResourceName={environment.resourceName}
                    />
                  </Box>
                )}
              </Box>
            )}
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
                      <Typography
                        variant="caption"
                        className={classes.releaseName}
                      >
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
                  <Box className={classes.deployedRow}>
                    <Typography
                      variant="caption"
                      className={classes.releaseNameLabel}
                    >
                      Deployed
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {formatRelativeTime(environment.deployment.lastDeployed)}
                    </Typography>
                  </Box>
                )}
                {driftInfo.isBehind && (
                  <Box className={classes.driftRow}>
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
                      <Box className={classes.driftLabel}>
                        <InfoOutlinedIcon fontSize="small" />
                        <Typography variant="caption">
                          Behind {driftInfo.aheadUpstreams[0]?.envName}
                        </Typography>
                      </Box>
                    </Tooltip>
                    {driftInfo.aheadUpstreams[0]?.releaseName &&
                      environment.deployment.releaseName && (
                        <Button
                          size="small"
                          variant="text"
                          color="primary"
                          className={classes.driftDiffButton}
                          startIcon={<CompareArrowsIcon fontSize="small" />}
                          onClick={() => setDiffOpen(true)}
                        >
                          View release diff
                        </Button>
                      )}
                  </Box>
                )}
                {activeIncidentCount !== undefined &&
                  activeIncidentCount > 0 && (
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
                        size="small"
                        startIcon={<DescriptionOutlinedIcon fontSize="small" />}
                        onClick={onOpenReleaseDetails}
                        style={{
                          textTransform: 'none',
                          color: artifactsButtonColor,
                          borderColor: artifactsButtonColor,
                        }}
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
                    modifyBindingDeniedTooltip ||
                    (environment.bindingName
                      ? 'Customise environment-specific overrides for this release.'
                      : 'Deploy this environment first to configure overrides.')
                  }
                  placement="top"
                >
                  <span>
                    <Button
                      variant="outlined"
                      color="primary"
                      size="small"
                      startIcon={<SettingsOutlinedIcon fontSize="small" />}
                      disabled={!environment.bindingName || !canModifyBinding}
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
                <Typography className={classes.sectionTitle}>
                  Actions
                </Typography>
                {showPromote && (
                  <>
                    <Box display="flex" justifyContent="flex-end">
                      <PromotePrimaryAction
                        environmentName={environment.name}
                        environmentResourceName={environment.resourceName}
                        bindingName={environment.bindingName}
                        deploymentStatus={environment.deployment.status}
                        statusReason={environment.deployment.statusReason}
                        promotionTargets={environment.promotionTargets}
                        isAlreadyPromoted={isAlreadyPromoted}
                        isTargetProjectBlocked={isTargetProjectBlocked}
                        promotionTracker={actionTrackers.promotionTracker}
                        onPromote={onPromote}
                      />
                    </Box>
                    {(() => {
                      // When a promote target's project isn't deployed there,
                      // the promote is disabled — surface the fix inline,
                      // targeting the first blocked target.
                      const blocked = (environment.promotionTargets ?? []).find(
                        t => isTargetProjectBlocked(t),
                      );
                      return blocked ? (
                        <Box mt={1}>
                          <ProjectNotDeployedCallout
                            variant="promote"
                            envName={blocked.name}
                            envResourceName={blocked.resourceName}
                          />
                        </Box>
                      ) : null;
                    })()}
                  </>
                )}
                <EnvironmentActions
                  environmentName={environment.name}
                  environmentResourceName={environment.resourceName}
                  bindingName={environment.bindingName}
                  deploymentStatus={environment.deployment.status}
                  statusReason={environment.deployment.statusReason}
                  suspendTracker={actionTrackers.suspendTracker}
                  rolloutRestartTracker={actionTrackers.rolloutRestartTracker}
                  canRolloutRestart={canModifyBinding}
                  rolloutRestartDeniedTooltip={modifyBindingDeniedTooltip}
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
                    <AccordionDetails
                      className={classes.dangerAccordionDetails}
                    >
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        style={{ marginBottom: 8 }}
                      >
                        Permanently delete this environment's deployment.
                      </Typography>
                      <Tooltip
                        title={removeDeploymentDeniedTooltip}
                        disableHoverListener={!removeDeploymentDeniedTooltip}
                      >
                        <span>
                          <Button
                            variant="outlined"
                            size="small"
                            className={classes.dangerButton}
                            startIcon={<DeleteOutlineIcon fontSize="small" />}
                            disabled={removeInFlight || !canRemoveDeployment}
                            onClick={() => setShowRemoveDialog(true)}
                          >
                            {removeInFlight
                              ? 'Removing...'
                              : 'Remove deployment'}
                          </Button>
                        </span>
                      </Tooltip>
                    </AccordionDetails>
                  </Accordion>
                )}
              </Box>
            )}
          </>
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
        onOpenReleaseBrowser={() => setBrowserOpen(true)}
      />

      <ReleaseBrowserDialog
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        releases={releases}
        deployments={deployments}
        selectedReleaseName={environment.deployment.releaseName ?? null}
        onConfirm={() => {}}
        environmentName={environment.name}
        loading={releasesLoading}
        readOnly
      />

      <ComponentReleaseDiffDialog
        open={diffOpen}
        onClose={() => setDiffOpen(false)}
        environmentName={environment.name}
        releaseName={environment.deployment.releaseName}
        upstreamEnvName={driftInfo.aheadUpstreams[0]?.envName ?? ''}
        upstreamReleaseName={driftInfo.aheadUpstreams[0]?.releaseName}
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
