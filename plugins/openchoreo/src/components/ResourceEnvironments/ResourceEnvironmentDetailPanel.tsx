import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Tooltip,
  Typography,
} from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import { useNavigate } from 'react-router-dom';
import { ToggleButton, ToggleButtonGroup } from '@material-ui/lab';
import { StatusBadge } from '@openchoreo/backstage-design-system';
import {
  useResourceReleaseBindingCreatePermission,
  useResourceReleaseBindingDeletePermission,
  useResourceReleaseBindingUpdatePermission,
} from '@openchoreo/backstage-plugin-react';
import type { ResourceEnvironment } from '../../api/OpenChoreoClientApi';
import { useResourceEnvironmentDetailPanelStyles } from './styles';
import { useResourceEnvironmentsContext } from './ResourceEnvironmentsContext';
import { ResourceOutputsList } from './ResourceOutputsList';
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
        <Box className={classes.emptyHero}>
          <Typography variant="body1">
            Select an environment from the pipeline to inspect its binding,
            outputs, and actions.
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
  const {
    pendingAction,
    onPromote,
    onDeploy,
    onUndeployRequest,
    onRetainPolicyChange,
  } = useResourceEnvironmentsContext();

  const hasBinding = Boolean(env.bindingName);
  const hasOutputs = Boolean(env.outputs && env.outputs.length > 0);
  const badgeStatus = deriveResourceEnvBadgeStatus(env);

  const isBehindLatest =
    hasBinding &&
    Boolean(env.latestRelease) &&
    env.resourceRelease !== env.latestRelease;
  const canDeploy = !hasBinding && Boolean(env.latestRelease);

  const updatePerm = useResourceReleaseBindingUpdatePermission(env.name);
  const createPerm = useResourceReleaseBindingCreatePermission(env.name);
  const deletePerm = useResourceReleaseBindingDeletePermission(env.name);

  const isPromoting =
    pendingAction?.env === env.name && pendingAction.kind === 'promote';
  const isDeploying =
    pendingAction?.env === env.name && pendingAction.kind === 'deploy';
  const isUndeploying =
    pendingAction?.env === env.name && pendingAction.kind === 'undeploy';
  const isUpdatingRetainPolicy =
    pendingAction?.env === env.name && pendingAction.kind === 'retain';

  return (
    <Box className={classes.panel}>
      <Box className={classes.header}>
        <Box className={classes.headerLeft}>
          <Typography variant="h6" className={classes.envName}>
            {env.name}
          </Typography>
          <StatusBadge status={badgeStatus} />
        </Box>
        <Box className={classes.headerRight}>
          <IconButton
            size="small"
            onClick={onClose}
            aria-label="Close detail panel"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      <Box className={classes.body}>
        {!hasBinding ? (
          <Box className={classes.section}>
            <Typography variant="body2" color="textSecondary">
              No binding in this environment yet.
            </Typography>
            {canDeploy && (
              <Box mt={2}>
                <DeployButton
                  targetRelease={env.latestRelease!}
                  canCreate={createPerm.canCreate}
                  permLoading={createPerm.loading}
                  deniedTooltip={createPerm.deniedTooltip}
                  isDeploying={isDeploying}
                  onClick={() => onDeploy(env.name, env.latestRelease!)}
                />
              </Box>
            )}
          </Box>
        ) : (
          <>
            <Box className={classes.section}>
              <Box className={classes.metaRow}>
                <Typography className={classes.metaLabel}>Release</Typography>
                <Box className={classes.releaseValueRow}>
                  <Typography className={classes.metaValue}>
                    {env.resourceRelease || '(unset)'}
                  </Typography>
                  {isBehindLatest && (
                    <Tooltip
                      title={`Behind latest release ${env.latestRelease}. Click Promote to advance.`}
                    >
                      <span className={classes.driftBadge}>Behind</span>
                    </Tooltip>
                  )}
                </Box>
              </Box>
              {env.retainPolicy && (
                <Box className={classes.metaRow}>
                  <Typography className={classes.metaLabel}>
                    Retain policy
                  </Typography>
                  <RetainPolicyToggle
                    current={env.retainPolicy}
                    canUpdate={updatePerm.canUpdate}
                    permLoading={updatePerm.loading}
                    deniedTooltip={updatePerm.deniedTooltip}
                    busy={isUpdatingRetainPolicy}
                    onChange={value => onRetainPolicyChange(env.name, value)}
                  />
                </Box>
              )}
              {env.statusReason && (
                <Box className={classes.metaRow}>
                  <Typography className={classes.metaLabel}>Reason</Typography>
                  <Typography className={classes.metaValue}>
                    {env.statusReason}
                  </Typography>
                </Box>
              )}
              {env.statusMessage && (
                <Box className={classes.metaRow}>
                  <Typography className={classes.metaLabel}>Message</Typography>
                  <Typography className={classes.metaValue}>
                    {env.statusMessage}
                  </Typography>
                </Box>
              )}
            </Box>

            <Box className={classes.section}>
              <Typography variant="body2" className={classes.sectionHeading}>
                Actions
              </Typography>
              <Box className={classes.actionsRow}>
                {isBehindLatest && (
                  <PromoteButton
                    targetRelease={env.latestRelease!}
                    canUpdate={updatePerm.canUpdate}
                    permLoading={updatePerm.loading}
                    deniedTooltip={updatePerm.deniedTooltip}
                    isPromoting={isPromoting}
                    onClick={() => onPromote(env.name, env.latestRelease!)}
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
                <UndeployButton
                  canDelete={deletePerm.canDelete}
                  permLoading={deletePerm.loading}
                  deniedTooltip={deletePerm.deniedTooltip}
                  isUndeploying={isUndeploying}
                  onClick={() => onUndeployRequest(env.name)}
                />
              </Box>
            </Box>

            {hasOutputs && (
              <Box className={classes.section}>
                <Typography variant="body2" className={classes.sectionHeading}>
                  Outputs
                </Typography>
                <ResourceOutputsList outputs={env.outputs!} />
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );
};

interface PromoteButtonProps {
  targetRelease: string;
  canUpdate: boolean;
  permLoading: boolean;
  deniedTooltip: string;
  isPromoting: boolean;
  onClick: () => void;
}

function PromoteButton({
  targetRelease,
  canUpdate,
  permLoading,
  deniedTooltip,
  isPromoting,
  onClick,
}: PromoteButtonProps) {
  const disabled = !canUpdate || permLoading || isPromoting;
  const tooltip =
    !canUpdate && !permLoading
      ? deniedTooltip
      : `Advance binding to ${targetRelease}`;
  return (
    <Tooltip title={tooltip}>
      <span>
        <Button
          size="small"
          variant="contained"
          color="primary"
          onClick={onClick}
          disabled={disabled}
          startIcon={
            isPromoting ? (
              <CircularProgress size={14} color="inherit" />
            ) : undefined
          }
        >
          Promote
        </Button>
      </span>
    </Tooltip>
  );
}

interface DeployButtonProps {
  targetRelease: string;
  canCreate: boolean;
  permLoading: boolean;
  deniedTooltip: string;
  isDeploying: boolean;
  onClick: () => void;
}

function DeployButton({
  targetRelease,
  canCreate,
  permLoading,
  deniedTooltip,
  isDeploying,
  onClick,
}: DeployButtonProps) {
  const disabled = !canCreate || permLoading || isDeploying;
  const tooltip =
    !canCreate && !permLoading
      ? deniedTooltip
      : `Create binding pinned to ${targetRelease}`;
  return (
    <Tooltip title={tooltip}>
      <span>
        <Button
          size="small"
          variant="contained"
          color="primary"
          onClick={onClick}
          disabled={disabled}
          startIcon={
            isDeploying ? (
              <CircularProgress size={14} color="inherit" />
            ) : undefined
          }
        >
          Deploy
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
          onClick={onClick}
          disabled={disabled}
        >
          Configure overrides
        </Button>
      </span>
    </Tooltip>
  );
}

interface UndeployButtonProps {
  canDelete: boolean;
  permLoading: boolean;
  deniedTooltip: string;
  isUndeploying: boolean;
  onClick: () => void;
}

function UndeployButton({
  canDelete,
  permLoading,
  deniedTooltip,
  isUndeploying,
  onClick,
}: UndeployButtonProps) {
  const disabled = !canDelete || permLoading || isUndeploying;
  const tooltip =
    !canDelete && !permLoading
      ? deniedTooltip
      : 'Delete the binding for this environment';
  return (
    <Tooltip title={tooltip}>
      <span>
        <Button
          size="small"
          variant="outlined"
          onClick={onClick}
          disabled={disabled}
          startIcon={
            isUndeploying ? (
              <CircularProgress size={14} color="inherit" />
            ) : undefined
          }
        >
          Undeploy
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
