import { Box, Chip, Tooltip, Typography } from '@material-ui/core';
import { StatusPending } from '@backstage/core-components';
import CheckCircleIcon from '@material-ui/icons/CheckCircleOutlined';
import ErrorIcon from '@material-ui/icons/ErrorOutlined';
import WarningIcon from '@material-ui/icons/ReportProblemOutlined';
import CloudOffIcon from '@material-ui/icons/CloudOff';
import { ComponentWithDeployment, type Environment } from '../hooks';
import { useProjectComponentsCardStyles } from './styles';

interface DeploymentStatusCellProps {
  component: ComponentWithDeployment;
  environments: Environment[];
}

export const DeploymentStatusCell = ({
  component,
  environments,
}: DeploymentStatusCellProps) => {
  const classes = useProjectComponentsCardStyles();

  return (
    <Box className={classes.deploymentStatus}>
      {environments.map(env => {
        const deployment = component.deploymentStatus?.[env.name.toLowerCase()];
        const isDeployed = deployment?.isDeployed || false;
        const status = deployment?.status;
        const statusReason = deployment?.statusReason;
        const statusMessage = deployment?.statusMessage;

        // Determine status icon and color
        let StatusIcon = null;
        let tooltipSuffix = 'Not deployed';
        let iconClass = '';

        if (isDeployed) {
          // Intentional undeploy — show with a muted icon
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
              tooltipSuffix = reasonDetail
                ? `${label} — ${reasonDetail}`
                : label;
            }
          }
        }

        const label = env.dnsPrefix || env.displayName || env.name;
        const envDisplayName = env.displayName || env.name;

        return (
          <Tooltip key={env.name} title={`${envDisplayName}: ${tooltipSuffix}`}>
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
      })}
    </Box>
  );
};
