import { useCallback, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Tooltip,
  Typography,
} from '@material-ui/core';
import AllInboxOutlinedIcon from '@material-ui/icons/AllInboxOutlined';
import CloseIcon from '@material-ui/icons/Close';
import CloudIcon from '@material-ui/icons/Cloud';
import CodeOutlinedIcon from '@material-ui/icons/CodeOutlined';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined';
import RefreshIcon from '@material-ui/icons/Refresh';
import ReportProblemOutlinedIcon from '@material-ui/icons/ReportProblemOutlined';
import SettingsOutlinedIcon from '@material-ui/icons/SettingsOutlined';
import { useNavigate } from 'react-router-dom';
import { ToggleButton, ToggleButtonGroup } from '@material-ui/lab';
import { StatusBadge } from '@openchoreo/backstage-design-system';
import {
  formatRelativeTime,
  useResourceReleaseBindingDeletePermission,
  useResourceReleaseBindingUpdatePermission,
} from '@openchoreo/backstage-plugin-react';
import { useNotification } from '../../hooks';
import type { ResourceEnvironment } from '../../api/OpenChoreoClientApi';
import { useResourceEnvironmentDetailPanelStyles } from './styles';
import { useResourceEnvironmentsContext } from './ResourceEnvironmentsContext';
import { ResourceOutputsDialog } from './ResourceOutputsDialog';
import { ResourceRetainPolicySwitchDialog } from './ResourceRetainPolicySwitchDialog';
import { deriveResourceEnvBadgeStatus } from './badgeStatus';

interface ResourceEnvironmentDetailPanelProps {
  env: ResourceEnvironment | null;
  onClose: () => void;
}

export const ResourceEnvironmentDetailPanel = ({
  env,
  onClose,
}: ResourceEnvironmentDetailPanelProps) => {
  const classes = useResourceEnvironmentDetailPanelStyles();

  if (!env) {
    return (
      <Box className={classes.panel}>
        <Box className={classes.emptyState}>
          <AllInboxOutlinedIcon className={classes.emptyIcon} />
          <Typography variant="body2">
            Select an environment to view details, or click{' '}
            <strong>Set up</strong> to update configuration.
          </Typography>
        </Box>
      </Box>
    );
  }

  return <ResourceEnvironmentDetailContent env={env} onClose={onClose} />;
};

interface ContentProps {
  env: ResourceEnvironment;
  onClose: () => void;
}

const ResourceEnvironmentDetailContent = ({ env, onClose }: ContentProps) => {
  const classes = useResourceEnvironmentDetailPanelStyles();
  const navigate = useNavigate();
  const notification = useNotification();
  const {
    environments,
    pendingAction,
    refetch,
    onPromote,
    onUndeployRequest,
    onRetainPolicyChange,
    onViewReleaseManifest,
  } = useResourceEnvironmentsContext();

  const [outputsDialogOpen, setOutputsDialogOpen] = useState(false);
  const [pendingRetainSwitchToDelete, setPendingRetainSwitchToDelete] =
    useState(false);
  const hasBinding = Boolean(env.bindingName);
  // BFF resolves the effective policy server-side: binding override →
  // (Cluster)ResourceType default → built-in 'Delete'. We still guard
  // with a fallback for the unbound case where retainPolicy is genuinely
  // absent from the response.
  const effectiveRetainPolicy: 'Delete' | 'Retain' =
    env.retainPolicy ?? 'Delete';
  const outputCount = env.outputs?.length ?? 0;
  const hasOutputs = outputCount > 0;
  const badgeStatus = deriveResourceEnvBadgeStatus(env);

  // Promote eligibility (forward-promote semantic, same as the env card):
  // shows when this env has a binding + release + at least one
  // promotion target that doesn't already have this release.
  const promotionTargets = env.promotionTargets ?? [];
  const eligibleTargets = env.resourceRelease
    ? promotionTargets.filter(t => {
        const targetEnv = environments.find(e => e.name === t.name);
        return targetEnv?.resourceRelease !== env.resourceRelease;
      })
    : [];
  const allTargetsInSync =
    promotionTargets.length > 0 && eligibleTargets.length === 0;
  const isPromotingForward = promotionTargets.some(
    t =>
      pendingAction?.kind === 'promote' &&
      pendingAction.env === (t.resourceName ?? t.name),
  );
  const showForwardPromote =
    hasBinding &&
    Boolean(env.resourceRelease) &&
    env.status === 'Ready' &&
    promotionTargets.length > 0;

  // Hide the status MESSAGE row on the happy path; show it only when the
  // binding isn't Ready so the user has the context to debug.
  const showStatusMessage = env.status !== 'Ready';

  const copyToClipboard = useCallback(
    async (text: string, label: string) => {
      try {
        await navigator.clipboard.writeText(text);
        notification.showSuccess(`Copied ${label}`);
      } catch {
        notification.showError('Failed to copy to clipboard');
      }
    },
    [notification],
  );

  const updatePerm = useResourceReleaseBindingUpdatePermission(env.name);
  const deletePerm = useResourceReleaseBindingDeletePermission(env.name);

  const isUndeploying =
    pendingAction?.env === (env.resourceName ?? env.name) &&
    pendingAction.kind === 'undeploy';
  const isUpdatingRetainPolicy =
    pendingAction?.env === (env.resourceName ?? env.name) &&
    pendingAction.kind === 'retain';

  const handlePromoteSingle = () => {
    const target = eligibleTargets[0];
    if (!target || !env.resourceRelease) return;
    // Promote needs the K8s-safe resource name (lowercase, RFC 1123).
    // target.name is the display name (e.g. "Production").
    void onPromote(target.resourceName ?? target.name, env.resourceRelease);
  };

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
            <Typography className={classes.envName}>{env.name}</Typography>
          </Box>
          <Box>
            <IconButton
              size="small"
              onClick={() => void refetch()}
              aria-label="Refresh environment status"
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
          <StatusBadge status={badgeStatus} />
        </Box>
      </Box>

      <Box className={classes.body}>
        {!hasBinding ? (
          <Box className={classes.section}>
            <Typography variant="body2" color="textSecondary">
              No binding in this environment yet. Use{' '}
              <strong>Set up</strong> on the pipeline canvas to deploy
              this resource for the first time, then promote forward
              through the environments.
            </Typography>
          </Box>
        ) : (
          <>
            <Box className={classes.section}>
              <Box className={classes.releaseNameRow}>
                <Typography
                  variant="caption"
                  className={classes.releaseNameLabel}
                >
                  Release
                </Typography>
                <Tooltip
                  title={env.resourceRelease || ''}
                  disableHoverListener={!env.resourceRelease}
                >
                  <Typography
                    variant="caption"
                    className={classes.releaseName}
                  >
                    {env.resourceRelease || '(unset)'}
                  </Typography>
                </Tooltip>
                {env.resourceRelease && (
                  <Tooltip
                    title="View release manifest"
                    PopperProps={{ disablePortal: true }}
                  >
                    <IconButton
                      size="small"
                      aria-label="View release manifest"
                      onClick={() => onViewReleaseManifest(env)}
                    >
                      <CodeOutlinedIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                )}
                {env.resourceRelease && (
                  <Tooltip
                    title="Copy release name"
                    PopperProps={{ disablePortal: true }}
                  >
                    <IconButton
                      size="small"
                      aria-label="Copy release name"
                      onClick={() =>
                        copyToClipboard(env.resourceRelease!, 'release name')
                      }
                    >
                      <FileCopyOutlinedIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
              {env.lastDeployed && (
                <Box className={classes.deployedRow}>
                  <Typography
                    variant="caption"
                    className={classes.releaseNameLabel}
                  >
                    Deployed
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {formatRelativeTime(env.lastDeployed)}
                  </Typography>
                </Box>
              )}
              {showStatusMessage && env.statusMessage && (
                <Box className={classes.releaseNameRow}>
                  <Typography
                    variant="caption"
                    className={classes.releaseNameLabel}
                  >
                    Message
                  </Typography>
                  <Tooltip title={env.statusMessage}>
                    <Typography
                      variant="caption"
                      className={classes.statusMessage}
                    >
                      {env.statusMessage}
                    </Typography>
                  </Tooltip>
                  <Tooltip
                    title="Copy status message"
                    PopperProps={{ disablePortal: true }}
                  >
                    <IconButton
                      size="small"
                      aria-label="Copy status message"
                      onClick={() =>
                        copyToClipboard(env.statusMessage!, 'status message')
                      }
                    >
                      <FileCopyOutlinedIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}
            </Box>

            {hasOutputs && (
              <Box className={classes.section}>
                <Box className={classes.sectionTitleRow}>
                  <Typography className={classes.sectionHeading}>
                    Outputs ({outputCount})
                  </Typography>
                  <Button
                    variant="text"
                    color="primary"
                    size="small"
                    onClick={() => setOutputsDialogOpen(true)}
                    style={{ textTransform: 'none' }}
                  >
                    View All
                  </Button>
                </Box>
              </Box>
            )}

            <Box className={classes.section}>
              <Box className={classes.sectionTitleRow}>
                <Typography className={classes.sectionHeading}>
                  Actions
                </Typography>
                <Box className={classes.actionsRow}>
                  {showForwardPromote && (
                    <ForwardPromoteButton
                      allTargetsInSync={allTargetsInSync}
                      eligibleTargets={eligibleTargets}
                      isPromotingForward={isPromotingForward}
                      onPromoteSingle={handlePromoteSingle}
                    />
                  )}
                  <ConfigureOverridesButton
                    canUpdate={updatePerm.canUpdate}
                    permLoading={updatePerm.loading}
                    deniedTooltip={updatePerm.deniedTooltip}
                    onClick={() =>
                      navigate(`overrides/${env.resourceName ?? env.name}`)
                    }
                  />
                </Box>
              </Box>
            </Box>

            <Box className={classes.section}>
              <Accordion className={classes.dangerAccordion}>
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
                  <Box className={classes.dangerSubsection}>
                    <Typography
                      variant="caption"
                      className={classes.dangerCaption}
                    >
                      Retain policy
                    </Typography>
                    <RetainPolicyToggle
                      current={effectiveRetainPolicy}
                      canUpdate={updatePerm.canUpdate}
                      permLoading={updatePerm.loading}
                      deniedTooltip={updatePerm.deniedTooltip}
                      busy={isUpdatingRetainPolicy}
                      onChange={value => {
                        // Retain → Delete removes the safety lock; warn
                        // before applying. Delete → Retain only adds
                        // safety, so apply immediately.
                        if (
                          value === 'Delete' &&
                          effectiveRetainPolicy === 'Retain'
                        ) {
                          setPendingRetainSwitchToDelete(true);
                          return;
                        }
                        void onRetainPolicyChange(
                          env.resourceName ?? env.name,
                          value,
                        );
                      }}
                    />
                    <Typography
                      variant="caption"
                      className={classes.dangerHelp}
                    >
                      Retain prevents this deployment from being deleted.
                      Switch to Delete to allow removal.
                    </Typography>
                  </Box>

                  <Box className={classes.dangerSubsection}>
                    <Typography
                      variant="caption"
                      className={classes.dangerCaption}
                    >
                      Permanently delete this environment's deployment.
                    </Typography>
                    <Tooltip
                      title={
                        effectiveRetainPolicy === 'Retain'
                          ? 'Set retain policy to Delete to allow removal.'
                          : deletePerm.deniedTooltip
                      }
                      disableHoverListener={
                        effectiveRetainPolicy === 'Delete' &&
                        deletePerm.canDelete
                      }
                    >
                      <span>
                        <Button
                          variant="outlined"
                          size="small"
                          className={classes.dangerButton}
                          startIcon={<DeleteOutlineIcon fontSize="small" />}
                          disabled={
                            isUndeploying ||
                            effectiveRetainPolicy === 'Retain' ||
                            deletePerm.loading ||
                            !deletePerm.canDelete
                          }
                          onClick={() =>
                            onUndeployRequest(env.resourceName ?? env.name)
                          }
                        >
                          {isUndeploying ? 'Removing...' : 'Remove deployment'}
                        </Button>
                      </span>
                    </Tooltip>
                  </Box>
                </AccordionDetails>
              </Accordion>
            </Box>
          </>
        )}
      </Box>

      <ResourceOutputsDialog
        open={outputsDialogOpen}
        onClose={() => setOutputsDialogOpen(false)}
        environmentName={env.name}
        outputs={env.outputs ?? []}
      />

      <ResourceRetainPolicySwitchDialog
        open={pendingRetainSwitchToDelete}
        isUpdating={isUpdatingRetainPolicy}
        onCancel={() => setPendingRetainSwitchToDelete(false)}
        onConfirm={async () => {
          setPendingRetainSwitchToDelete(false);
          await onRetainPolicyChange(env.resourceName ?? env.name, 'Delete');
        }}
      />
    </Box>
  );
};

interface ForwardPromoteButtonProps {
  allTargetsInSync: boolean;
  eligibleTargets: Array<{ name: string }>;
  isPromotingForward: boolean;
  onPromoteSingle: () => void;
}

function ForwardPromoteButton({
  allTargetsInSync,
  eligibleTargets,
  isPromotingForward,
  onPromoteSingle,
}: ForwardPromoteButtonProps) {
  if (allTargetsInSync) {
    return (
      <Button size="small" variant="contained" disabled>
        Promoted
      </Button>
    );
  }
  // Single-target fast path. Resource pipelines are typically linear, so
  // multi-target dropdown lives on the env card (cleaner anchor); the
  // panel just promotes to the first eligible target for parity.
  const target = eligibleTargets[0];
  if (!target) return null;
  return (
    <Tooltip title={`Promote to ${target.name}`}>
      <span>
        <Button
          size="small"
          variant="contained"
          color="primary"
          onClick={onPromoteSingle}
          disabled={isPromotingForward}
          startIcon={
            isPromotingForward ? (
              <CircularProgress size={14} color="inherit" />
            ) : undefined
          }
        >
          {isPromotingForward ? 'Promoting...' : 'Promote'}
        </Button>
      </span>
    </Tooltip>
  );
}

interface ConfigureOverridesButtonProps {
  canUpdate: boolean;
  permLoading: boolean;
  deniedTooltip: string;
  onClick: () => void;
}

function ConfigureOverridesButton({
  canUpdate,
  permLoading,
  deniedTooltip,
  onClick,
}: ConfigureOverridesButtonProps) {
  const disabled = !canUpdate || permLoading;
  const tooltip =
    !canUpdate && !permLoading
      ? deniedTooltip
      : 'Edit per-environment parameter overrides for this binding';
  return (
    <Tooltip title={tooltip}>
      <span>
        <Button
          size="small"
          variant="outlined"
          color="primary"
          startIcon={<SettingsOutlinedIcon fontSize="small" />}
          onClick={onClick}
          disabled={disabled}
          style={{ textTransform: 'none' }}
        >
          Configure overrides
        </Button>
      </span>
    </Tooltip>
  );
}

interface RetainPolicyToggleProps {
  current: 'Delete' | 'Retain';
  canUpdate: boolean;
  permLoading: boolean;
  deniedTooltip: string;
  busy: boolean;
  onChange: (next: 'Delete' | 'Retain') => void;
}

function RetainPolicyToggle({
  current,
  canUpdate,
  permLoading,
  deniedTooltip,
  busy,
  onChange,
}: RetainPolicyToggleProps) {
  if (!canUpdate && !permLoading) {
    return (
      <Tooltip title={deniedTooltip}>
        <span>
          <Typography
            variant="body2"
            style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
          >
            {current}
          </Typography>
        </span>
      </Tooltip>
    );
  }

  return (
    <Box display="flex" alignItems="center" gridGap={8}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={current}
        onChange={(_e, next) => {
          if (next && next !== current) onChange(next as 'Delete' | 'Retain');
        }}
        aria-label="Retain policy"
      >
        <ToggleButton value="Delete" disabled={busy || permLoading}>
          Delete
        </ToggleButton>
        <ToggleButton value="Retain" disabled={busy || permLoading}>
          Retain
        </ToggleButton>
      </ToggleButtonGroup>
      {busy && <CircularProgress size={14} />}
    </Box>
  );
}
