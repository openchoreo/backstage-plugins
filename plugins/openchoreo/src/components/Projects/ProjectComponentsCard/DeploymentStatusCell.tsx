import { Box, Chip, Tooltip, Typography } from '@material-ui/core';
import { StatusPending } from '@backstage/core-components';
import CheckCircleIcon from '@material-ui/icons/CheckCircleOutlined';
import ErrorIcon from '@material-ui/icons/ErrorOutline';
import WarningIcon from '@material-ui/icons/ReportProblemOutlined';
import CloudOffIcon from '@material-ui/icons/CloudOff';
import { ComponentWithDeployment, type Environment } from '../hooks';
import { useProjectComponentsCardStyles } from './styles';

const MAX_VISIBLE_CHIPS = 3;

interface DeploymentStatusCellProps {
  component: ComponentWithDeployment;
  environments: Environment[];
}

type EnvStatusInfo = {
  tooltipSuffix: string;
  StatusIcon: React.ElementType | null;
  iconClass: string;
};

const useEnvStatus = (
  component: ComponentWithDeployment,
  env: Environment,
  classes: ReturnType<typeof useProjectComponentsCardStyles>,
): EnvStatusInfo => {
  const deployment = component.deploymentStatus?.[env.name.toLowerCase()];
  const isDeployed = deployment?.isDeployed || false;
  const status = deployment?.status;
  const statusReason = deployment?.statusReason;
  const statusMessage = deployment?.statusMessage;

  let StatusIcon: React.ElementType | null = null;
  let tooltipSuffix = 'Not deployed';
  let iconClass = '';

  if (isDeployed) {
    if (statusReason === 'ResourcesUndeployed') {
      StatusIcon = CloudOffIcon;
      iconClass = classes.statusIconDefault;
      tooltipSuffix = 'Undeployed';
    } else {
      let reasonDetail: string | undefined;
      if (statusReason && statusMessage) {
        reasonDetail = `${statusReason}: ${statusMessage}`;
      } else if (statusReason) {
        reasonDetail = statusReason;
      }

      if (status === 'Ready') {
        StatusIcon = CheckCircleIcon;
        iconClass = classes.statusIconReady;
        tooltipSuffix = reasonDetail
          ? `Deployed (Ready — ${reasonDetail})`
          : 'Deployed (Ready)';
      } else if (status === 'Failed') {
        StatusIcon = ErrorIcon;
        iconClass = classes.statusIconError;
        tooltipSuffix = reasonDetail
          ? `Deployed (Failed — ${reasonDetail})`
          : 'Deployed (Failed)';
      } else if (status === 'NotReady') {
        StatusIcon = WarningIcon;
        iconClass = classes.statusIconWarning;
        tooltipSuffix = reasonDetail
          ? `Deployed (NotReady — ${reasonDetail})`
          : 'Deployed (NotReady)';
      } else {
        StatusIcon = StatusPending;
        const label = status ? `Deployed (${status})` : 'Deployed';
        tooltipSuffix = reasonDetail ? `${label} — ${reasonDetail}` : label;
      }
    }
  }

  return { tooltipSuffix, StatusIcon, iconClass };
};

const EnvironmentChip = ({
  component,
  env,
}: {
  component: ComponentWithDeployment;
  env: Environment;
}) => {
  const classes = useProjectComponentsCardStyles();
  const { tooltipSuffix, StatusIcon, iconClass } = useEnvStatus(
    component,
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
  component,
  hiddenEnvironments,
}: {
  component: ComponentWithDeployment;
  hiddenEnvironments: Environment[];
}) => {
  const classes = useProjectComponentsCardStyles();

  return (
    <Tooltip
      title={
        <Box>
          {hiddenEnvironments.map(env => {
            const deployment =
              component.deploymentStatus?.[env.name.toLowerCase()];
            const isDeployed = deployment?.isDeployed || false;
            const status = deployment?.status;
            const statusReason = deployment?.statusReason;
            const envDisplayName = env.displayName || env.name;

            let statusText = 'Not deployed';
            if (isDeployed) {
              if (statusReason === 'ResourcesUndeployed') {
                statusText = 'Undeployed';
              } else {
                statusText = status ? `Deployed (${status})` : 'Deployed';
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

export const DeploymentStatusCell = ({
  component,
  environments,
}: DeploymentStatusCellProps) => {
  const classes = useProjectComponentsCardStyles();

  const visibleEnvironments = environments.slice(0, MAX_VISIBLE_CHIPS);
  const hiddenEnvironments = environments.slice(MAX_VISIBLE_CHIPS);

  return (
    <Box className={classes.deploymentStatus}>
      {visibleEnvironments.map(env => (
        <EnvironmentChip key={env.name} component={component} env={env} />
      ))}
      {hiddenEnvironments.length > 0 && (
        <MoreChip
          component={component}
          hiddenEnvironments={hiddenEnvironments}
        />
      )}
    </Box>
  );
};
