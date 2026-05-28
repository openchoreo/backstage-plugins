import { Box, Chip, Tooltip, Typography } from '@material-ui/core';
import { StatusPending } from '@backstage/core-components';
import CheckCircleIcon from '@material-ui/icons/CheckCircleOutlined';
import ErrorIcon from '@material-ui/icons/ErrorOutline';
import WarningIcon from '@material-ui/icons/ReportProblemOutlined';
import CloudOffIcon from '@material-ui/icons/CloudOff';
import { type DeploymentStatusByEnv, type Environment } from '../hooks';
import { useProjectContentsCardStyles } from './styles';

const MAX_VISIBLE_CHIPS = 3;

type Classes = ReturnType<typeof useProjectContentsCardStyles>;

interface EnvStatusInfo {
  tooltipSuffix: string;
  StatusIcon: React.ElementType | null;
  iconClass: string;
}

function getEnvStatusInfo(
  deploymentStatus: DeploymentStatusByEnv,
  env: Environment,
  classes: Classes,
): EnvStatusInfo {
  const deployment = deploymentStatus[env.name.toLowerCase()];

  if (!deployment?.isDeployed) {
    return { tooltipSuffix: 'Not deployed', StatusIcon: null, iconClass: '' };
  }

  const { status, statusReason, statusMessage } = deployment;

  if (statusReason === 'ResourcesUndeployed') {
    return {
      tooltipSuffix: 'Undeployed',
      StatusIcon: CloudOffIcon,
      iconClass: classes.statusIconDefault,
    };
  }

  let reasonDetail: string | undefined;
  if (statusReason && statusMessage) {
    reasonDetail = `${statusReason}: ${statusMessage}`;
  } else if (statusReason) {
    reasonDetail = statusReason;
  }

  switch (status) {
    case 'Ready':
      return {
        StatusIcon: CheckCircleIcon,
        iconClass: classes.statusIconReady,
        tooltipSuffix: reasonDetail
          ? `Deployed (Ready — ${reasonDetail})`
          : 'Deployed (Ready)',
      };
    case 'Failed':
      return {
        StatusIcon: ErrorIcon,
        iconClass: classes.statusIconError,
        tooltipSuffix: reasonDetail
          ? `Deployed (Failed — ${reasonDetail})`
          : 'Deployed (Failed)',
      };
    case 'NotReady':
      return {
        StatusIcon: WarningIcon,
        iconClass: classes.statusIconWarning,
        tooltipSuffix: reasonDetail
          ? `Deployed (NotReady — ${reasonDetail})`
          : 'Deployed (NotReady)',
      };
    default: {
      const label = status ? `Deployed (${status})` : 'Deployed';
      return {
        StatusIcon: StatusPending,
        iconClass: '',
        tooltipSuffix: reasonDetail ? `${label} — ${reasonDetail}` : label,
      };
    }
  }
}

const EnvironmentChip = ({
  deploymentStatus,
  env,
}: {
  deploymentStatus: DeploymentStatusByEnv;
  env: Environment;
}) => {
  const classes = useProjectContentsCardStyles();
  const { tooltipSuffix, StatusIcon, iconClass } = getEnvStatusInfo(
    deploymentStatus,
    env,
    classes,
  );
  const label = env.dnsPrefix || env.displayName || env.name;
  const envDisplayName = env.displayName || env.name;

  return (
    <Tooltip title={`${envDisplayName}: ${tooltipSuffix}`}>
      <Box className={classes.chipContainer}>
        <Chip
          size="small"
          className={classes.environmentChip}
          label={
            <Box display="flex" alignItems="center" gridGap={1}>
              <Typography variant="body2">{label}</Typography>
              {StatusIcon && (
                <StatusIcon
                  className={iconClass}
                  style={{ fontSize: '18px' }}
                />
              )}
            </Box>
          }
          color="default"
          variant="outlined"
        />
      </Box>
    </Tooltip>
  );
};

const MoreChip = ({
  deploymentStatus,
  hiddenEnvironments,
}: {
  deploymentStatus: DeploymentStatusByEnv;
  hiddenEnvironments: Environment[];
}) => {
  const classes = useProjectContentsCardStyles();

  return (
    <Tooltip
      title={
        <Box>
          {hiddenEnvironments.map(env => {
            const deployment = deploymentStatus[env.name.toLowerCase()];
            const envDisplayName = env.displayName || env.name;

            let statusText = 'Not deployed';
            if (deployment?.isDeployed) {
              if (deployment.statusReason === 'ResourcesUndeployed') {
                statusText = 'Undeployed';
              } else if (deployment.status) {
                statusText = `Deployed (${deployment.status})`;
              } else {
                statusText = 'Deployed';
              }
            }

            return (
              <Typography key={env.name} variant="caption" display="block">
                {envDisplayName}: {statusText}
              </Typography>
            );
          })}
        </Box>
      }
    >
      <Chip
        size="small"
        className={classes.moreChip}
        label={`+${hiddenEnvironments.length} more`}
        variant="outlined"
      />
    </Tooltip>
  );
};

interface DeploymentStatusCellProps {
  deploymentStatus: DeploymentStatusByEnv;
  environments: Environment[];
}

export const DeploymentStatusCell = ({
  deploymentStatus,
  environments,
}: DeploymentStatusCellProps) => {
  const classes = useProjectContentsCardStyles();

  if (environments.length === 0) {
    return (
      <Typography variant="body2" className={classes.notDeployed}>
        —
      </Typography>
    );
  }

  const visibleEnvironments = environments.slice(0, MAX_VISIBLE_CHIPS);
  const hiddenEnvironments = environments.slice(MAX_VISIBLE_CHIPS);

  return (
    <Box className={classes.deploymentStatus}>
      {visibleEnvironments.map(env => (
        <EnvironmentChip
          key={env.name}
          deploymentStatus={deploymentStatus}
          env={env}
        />
      ))}
      {hiddenEnvironments.length > 0 && (
        <MoreChip
          deploymentStatus={deploymentStatus}
          hiddenEnvironments={hiddenEnvironments}
        />
      )}
    </Box>
  );
};
