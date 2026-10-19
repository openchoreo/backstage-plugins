import { useCallback } from 'react';
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
import { makeStyles } from '@material-ui/core/styles';
import AllInboxOutlinedIcon from '@material-ui/icons/AllInboxOutlined';
import CheckCircleOutlineIcon from '@material-ui/icons/CheckCircleOutline';
import CloseIcon from '@material-ui/icons/Close';
import CloudIcon from '@material-ui/icons/Cloud';
import CodeOutlinedIcon from '@material-ui/icons/CodeOutlined';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined';
import RefreshIcon from '@material-ui/icons/Refresh';
import ReportProblemOutlinedIcon from '@material-ui/icons/ReportProblemOutlined';
import SettingsOutlinedIcon from '@material-ui/icons/SettingsOutlined';
import { useNavigate } from 'react-router-dom';
import { StatusBadge } from '@openchoreo/backstage-design-system';
import type { ResolvedEndpointBackend } from '@openchoreo/backstage-plugin-common';
import {
  formatRelativeTime,
  useEndpointPromoteToEnvPermission,
  useEndpointReleaseBindingDeletePermission,
  useEndpointReleaseBindingUpdatePermission,
} from '@openchoreo/backstage-plugin-react';
import { useNotification } from '../../hooks';
import type { EndpointEnvironment } from '../../api/OpenChoreoClientApi';
import { useResourceEnvironmentDetailPanelStyles } from '../ResourceEnvironments/styles';
import { useEndpointEnvironmentsContext } from './EndpointEnvironmentsContext';
import {
  deriveEndpointEnvBadgeStatus,
  envResourceName,
  formatServiceURL,
} from './endpointEnvironmentUtils';

const useBackendStyles = makeStyles(theme => ({
  resolvedIcon: {
    color: theme.palette.success.main,
  },
}));

interface EndpointEnvironmentDetailPanelProps {
  env: EndpointEnvironment | null;
  onClose: () => void;
}

/**
 * Right-hand pane of the Endpoint deploy view: the release pinned to the
 * selected environment, its status, how each backend resolved there, and the
 * Promote, Configure overrides and Remove deployment actions.
 */
export const EndpointEnvironmentDetailPanel = ({
  env,
  onClose,
}: EndpointEnvironmentDetailPanelProps) => {
  const classes = useResourceEnvironmentDetailPanelStyles();

  if (!env) {
    return (
      <Box className={classes.panel}>
        <Box className={classes.emptyState}>
          <AllInboxOutlinedIcon className={classes.emptyIcon} />
          <Typography variant="body2">
            Select an environment to view details, or click{' '}
            <strong>Set up</strong> to deploy the latest release.
          </Typography>
        </Box>
      </Box>
    );
  }

  return <EndpointEnvironmentDetailContent env={env} onClose={onClose} />;
};

function EndpointEnvironmentDetailContent({
  env,
  onClose,
}: {
  env: EndpointEnvironment;
  onClose: () => void;
}) {
  const classes = useResourceEnvironmentDetailPanelStyles();
  const navigate = useNavigate();
  const notification = useNotification();
  const {
    environments,
    pendingAction,
    refetch,
    onPromote,
    onUndeployRequest,
    onViewReleaseManifest,
  } = useEndpointEnvironmentsContext();

  const envName = envResourceName(env);
  const hasBinding = Boolean(env.bindingName);
  const badgeStatus = deriveEndpointEnvBadgeStatus(env);
  const updatePerm = useEndpointReleaseBindingUpdatePermission(envName);
  const deletePerm = useEndpointReleaseBindingDeletePermission(envName);

  // Promote copies this environment's release forward to the next one; the
  // pipeline's promotion targets enforce the ordering.
  const promotionTargets = env.promotionTargets ?? [];
  const eligibleTargets = env.endpointRelease
    ? promotionTargets.filter(t => {
        const targetEnv = environments.find(e => e.name === t.name);
        return targetEnv?.endpointRelease !== env.endpointRelease;
      })
    : [];
  const allTargetsInSync =
    promotionTargets.length > 0 && eligibleTargets.length === 0;
  const isPromoting = promotionTargets.some(
    t =>
      pendingAction?.kind === 'promote' &&
      pendingAction.env === envResourceName(t),
  );
  const showPromote =
    hasBinding &&
    Boolean(env.endpointRelease) &&
    env.status === 'Ready' &&
    promotionTargets.length > 0;
  const isUndeploying =
    pendingAction?.env === envName && pendingAction.kind === 'undeploy';

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

  const handlePromote = () => {
    const target = eligibleTargets[0];
    if (!target || !env.endpointRelease) return;
    void onPromote(envResourceName(target), env.endpointRelease);
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
              Not deployed to this environment yet. Use <strong>Set up</strong>{' '}
              on the pipeline canvas to deploy the endpoint for the first time,
              then promote it forward through the environments.
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
                  title={env.endpointRelease || ''}
                  disableHoverListener={!env.endpointRelease}
                >
                  <Typography variant="caption" className={classes.releaseName}>
                    {env.endpointRelease || '(unset)'}
                  </Typography>
                </Tooltip>
                {env.endpointRelease && (
                  <>
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
                    <Tooltip
                      title="Copy release name"
                      PopperProps={{ disablePortal: true }}
                    >
                      <IconButton
                        size="small"
                        aria-label="Copy release name"
                        onClick={() =>
                          copyToClipboard(env.endpointRelease!, 'release name')
                        }
                      >
                        <FileCopyOutlinedIcon fontSize="inherit" />
                      </IconButton>
                    </Tooltip>
                  </>
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
              {env.status !== 'Ready' && env.statusMessage && (
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
                </Box>
              )}
            </Box>

            <BackendsSection backends={env.backends ?? []} />

            <Box className={classes.section}>
              <Box className={classes.sectionTitleRow}>
                <Typography className={classes.sectionHeading}>
                  Actions
                </Typography>
                <Box className={classes.actionsRow}>
                  {showPromote &&
                    (allTargetsInSync ? (
                      <Button size="small" variant="contained" disabled>
                        Promoted
                      </Button>
                    ) : (
                      eligibleTargets[0] && (
                        <PromoteButton
                          target={eligibleTargets[0]}
                          isPromoting={isPromoting}
                          onClick={handlePromote}
                        />
                      )
                    ))}
                  <Tooltip
                    title={
                      !updatePerm.canUpdate && !updatePerm.loading
                        ? updatePerm.deniedTooltip
                        : 'Edit per-environment values for this binding'
                    }
                  >
                    <span>
                      <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        startIcon={<SettingsOutlinedIcon fontSize="small" />}
                        onClick={() => navigate(`overrides/${envName}`)}
                        disabled={!updatePerm.canUpdate || updatePerm.loading}
                        style={{ textTransform: 'none' }}
                      >
                        Configure overrides
                      </Button>
                    </span>
                  </Tooltip>
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
                      Remove this endpoint&apos;s routes from {env.name}.
                    </Typography>
                    <Tooltip
                      title={deletePerm.deniedTooltip}
                      disableHoverListener={deletePerm.canDelete}
                    >
                      <span>
                        <Button
                          variant="outlined"
                          size="small"
                          className={classes.dangerButton}
                          startIcon={<DeleteOutlineIcon fontSize="small" />}
                          disabled={
                            isUndeploying ||
                            deletePerm.loading ||
                            !deletePerm.canDelete
                          }
                          onClick={() => onUndeployRequest(envName)}
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
    </Box>
  );
}

/**
 * How each backend resolved in this environment: its in-cluster address, or
 * why it did not resolve (e.g. its component is not deployed here, or its
 * workload endpoint is not internal or external).
 */
function BackendsSection({
  backends,
}: {
  backends: ResolvedEndpointBackend[];
}) {
  const classes = useResourceEnvironmentDetailPanelStyles();
  const backendClasses = useBackendStyles();
  if (backends.length === 0) return null;

  return (
    <Box className={classes.section}>
      <Typography className={classes.sectionHeading}>
        Backends ({backends.length})
      </Typography>
      {backends.map(backend => {
        const url = formatServiceURL(backend.serviceURL);
        return (
          <Box key={backend.name} mt={1} display="flex" gridGap={8}>
            {backend.resolved ? (
              <CheckCircleOutlineIcon
                fontSize="small"
                className={backendClasses.resolvedIcon}
                aria-label="Resolved"
              />
            ) : (
              <ErrorOutlineIcon
                fontSize="small"
                color="error"
                aria-label="Not resolved"
              />
            )}
            <Box minWidth={0}>
              <Typography variant="body2">
                {backend.name}
                {backend.weight !== undefined && (
                  <Typography
                    component="span"
                    variant="caption"
                    color="textSecondary"
                  >
                    {` · weight ${backend.weight}`}
                  </Typography>
                )}
              </Typography>
              {backend.resolved
                ? url && (
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      style={{ wordBreak: 'break-all' }}
                    >
                      {url}
                    </Typography>
                  )
                : (backend.reason || backend.message) && (
                    <Typography variant="caption" color="error">
                      {[backend.reason, backend.message]
                        .filter(Boolean)
                        .join(': ')}
                    </Typography>
                  )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * Promote button gated by `endpointreleasebinding:create` and `:update` on
 * the target environment. Mounted only with a real target so the permission
 * hook always receives a stable argument.
 */
function PromoteButton({
  target,
  isPromoting,
  onClick,
}: {
  target: { name: string; resourceName?: string };
  isPromoting: boolean;
  onClick: () => void;
}) {
  const { canPromote, loading, deniedTooltip } =
    useEndpointPromoteToEnvPermission(envResourceName(target));
  const tooltip =
    !canPromote && !loading ? deniedTooltip : `Promote to ${target.name}`;
  return (
    <Tooltip title={tooltip}>
      <span>
        <Button
          size="small"
          variant="contained"
          color="primary"
          onClick={onClick}
          disabled={isPromoting || loading || !canPromote}
          startIcon={
            isPromoting ? (
              <CircularProgress size={14} color="inherit" />
            ) : undefined
          }
        >
          {isPromoting ? 'Promoting...' : 'Promote'}
        </Button>
      </span>
    </Tooltip>
  );
}
