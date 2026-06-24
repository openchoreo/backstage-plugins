import { useCallback } from 'react';
import {
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
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined';
import RefreshIcon from '@material-ui/icons/Refresh';
import SettingsOutlinedIcon from '@material-ui/icons/SettingsOutlined';
import { useNavigate } from 'react-router-dom';
import { StatusBadge } from '@openchoreo/backstage-design-system';
import {
  formatRelativeTime,
  useProjectUpdatePermission,
} from '@openchoreo/backstage-plugin-react';
import { useNotification } from '../../hooks';
import type { ProjectEnvironment } from '../../api/OpenChoreoClientApi';
import { useProjectEnvironmentDetailPanelStyles } from './styles';
import { useProjectEnvironmentsContext } from './ProjectEnvironmentsContext';
import { deriveProjectEnvBadgeStatus } from './badgeStatus';

interface ProjectEnvironmentDetailPanelProps {
  env: ProjectEnvironment | null;
  onClose: () => void;
}

export const ProjectEnvironmentDetailPanel = ({
  env,
  onClose,
}: ProjectEnvironmentDetailPanelProps) => {
  const classes = useProjectEnvironmentDetailPanelStyles();

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

  return <ProjectEnvironmentDetailContent env={env} onClose={onClose} />;
};

interface ContentProps {
  env: ProjectEnvironment;
  onClose: () => void;
}

function ProjectEnvironmentDetailContent({ env, onClose }: ContentProps) {
  const classes = useProjectEnvironmentDetailPanelStyles();
  const navigate = useNavigate();
  const notification = useNotification();
  const { environments, pendingAction, refetch, onPromote } =
    useProjectEnvironmentsContext();
  const {
    canUpdate,
    loading: permLoading,
    updateDeniedTooltip,
  } = useProjectUpdatePermission();

  const hasBinding = Boolean(env.bindingName);
  const badgeStatus = deriveProjectEnvBadgeStatus(env);

  // Promote eligibility: shows when this env has a binding + release + at
  // least one promotion target that doesn't already have this release.
  // Promote copies this env's release pin forward to the next env's
  // binding; the pipeline-defined `promotionTargets` enforces ordering
  // (the terminal env has no targets, so the button never appears there).
  const promotionTargets = env.promotionTargets ?? [];
  const eligibleTargets = env.projectRelease
    ? promotionTargets.filter(t => {
        const targetEnv = environments.find(e => e.name === t.name);
        return targetEnv?.projectRelease !== env.projectRelease;
      })
    : [];
  const allTargetsInSync =
    promotionTargets.length > 0 && eligibleTargets.length === 0;
  const isPromoting = promotionTargets.some(
    t =>
      pendingAction?.kind === 'promote' &&
      pendingAction.env === (t.resourceName ?? t.name),
  );
  const showPromote =
    hasBinding &&
    Boolean(env.projectRelease) &&
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

  const handlePromoteSingle = () => {
    const target = eligibleTargets[0];
    if (!target || !env.projectRelease) return;
    // Promote needs the K8s-safe resource name (lowercase, RFC 1123).
    // target.name is the display name (e.g. "Production").
    void onPromote(target.resourceName ?? target.name, env.projectRelease);
  };

  const promoteDisabled = isPromoting || permLoading || !canUpdate;
  const promoteTooltip =
    !canUpdate && !permLoading
      ? updateDeniedTooltip
      : `Promote to ${eligibleTargets[0]?.name ?? ''}`;
  const overridesDisabled = permLoading || !canUpdate;
  const overridesTooltip =
    !canUpdate && !permLoading
      ? updateDeniedTooltip
      : 'Edit per-environment overrides for this binding';

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
              No binding in this environment yet. Use <strong>Set up</strong> on
              the pipeline canvas to deploy this project for the first time,
              then promote forward through the environments.
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
                  title={env.projectRelease || ''}
                  disableHoverListener={!env.projectRelease}
                >
                  <Typography variant="caption" className={classes.releaseName}>
                    {env.projectRelease || '(unset)'}
                  </Typography>
                </Tooltip>
                {env.projectRelease && (
                  <Tooltip
                    title="Copy release name"
                    PopperProps={{ disablePortal: true }}
                  >
                    <IconButton
                      size="small"
                      aria-label="Copy release name"
                      onClick={() =>
                        copyToClipboard(env.projectRelease!, 'release name')
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
              {env.namespace && (
                <Box className={classes.releaseNameRow}>
                  <Typography
                    variant="caption"
                    className={classes.releaseNameLabel}
                  >
                    Namespace
                  </Typography>
                  <Tooltip title={env.namespace}>
                    <Typography
                      variant="caption"
                      className={classes.releaseName}
                    >
                      {env.namespace}
                    </Typography>
                  </Tooltip>
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
                </Box>
              )}
            </Box>

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
                      <Tooltip
                        title={promoteTooltip}
                        disableHoverListener={!promoteTooltip}
                      >
                        <span>
                          <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            onClick={handlePromoteSingle}
                            disabled={promoteDisabled}
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
                    ))}
                  <Tooltip title={overridesTooltip}>
                    <span>
                      <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        startIcon={<SettingsOutlinedIcon fontSize="small" />}
                        onClick={() =>
                          navigate(
                            `overrides/${encodeURIComponent(
                              env.resourceName ?? env.name,
                            )}`,
                          )
                        }
                        disabled={overridesDisabled}
                        style={{ textTransform: 'none' }}
                      >
                        Configure overrides
                      </Button>
                    </span>
                  </Tooltip>
                </Box>
              </Box>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}
