import {
  Box,
  Button,
  IconButton,
  Tooltip,
  Typography,
} from '@material-ui/core';
import SettingsOutlinedIcon from '@material-ui/icons/SettingsOutlined';
import CloseIcon from '@material-ui/icons/Close';
import clsx from 'clsx';
import { useEndpointPromoteToEnvPermission } from '@openchoreo/backstage-plugin-react';
import type { EndpointEnvironment } from '../../api/OpenChoreoClientApi';
import {
  useResourceEnvironmentDetailPanelStyles,
  useResourceSetupCardCompactStyles,
} from '../ResourceEnvironments/styles';
import { useEndpointEnvironmentsContext } from './EndpointEnvironmentsContext';
import { envResourceName } from './endpointEnvironmentUtils';

/** Compact Set up tile at the start of the Endpoint deploy canvas. */
export const EndpointSetupCard = ({ selected }: { selected: boolean }) => {
  const classes = useResourceSetupCardCompactStyles();
  return (
    <Box
      className={clsx(classes.setupCard, { [classes.cardSelected]: selected })}
    >
      <Box className={classes.titleRow}>
        <SettingsOutlinedIcon className={classes.titleIcon} />
        <Typography className={classes.title}>Set up</Typography>
      </Box>
      <Typography className={classes.hint}>Deploy latest release</Typography>
    </Box>
  );
};

/**
 * Right-pane body for the Set up tile. Deploys the Endpoint's latest release
 * to the first environment in the pipeline, from where it is promoted
 * forward. The Endpoint itself is edited on the Definition tab; every change
 * cuts a new release, which shows up here as the latest.
 */
export const EndpointSetupDetailPane = ({
  firstEnvironment,
  onClose,
}: {
  firstEnvironment: EndpointEnvironment;
  onClose: () => void;
}) => {
  const classes = useResourceEnvironmentDetailPanelStyles();
  const { pendingAction, onPromote } = useEndpointEnvironmentsContext();
  const targetEnv = envResourceName(firstEnvironment);
  const { canPromote, loading, deniedTooltip } =
    useEndpointPromoteToEnvPermission(targetEnv);

  const latest = firstEnvironment.latestRelease;
  const onLatest =
    Boolean(latest) && firstEnvironment.endpointRelease === latest;
  const isDeploying =
    pendingAction?.kind === 'promote' && pendingAction.env === targetEnv;

  let description: string;
  if (!latest) {
    description =
      'This endpoint has no release yet. Releases are cut once the endpoint and its type are valid; check its status on the Overview tab.';
  } else if (onLatest) {
    description = `${firstEnvironment.name} already runs the latest release, ${latest}. Promote it forward from the pipeline.`;
  } else if (firstEnvironment.endpointRelease) {
    description = `${firstEnvironment.name} runs ${firstEnvironment.endpointRelease}. Deploy the latest release, ${latest}, to update it.`;
  } else {
    description = `Deploy the latest release, ${latest}, to ${firstEnvironment.name}, the first environment in the pipeline.`;
  }

  return (
    <Box className={classes.panel}>
      <Box className={classes.setupHeader}>
        <Box className={classes.headerTopRow}>
          <Box className={classes.headerNameRow}>
            <SettingsOutlinedIcon
              className={classes.headerKindIcon}
              fontSize="small"
              aria-hidden
            />
            <Typography className={classes.envName}>Set up</Typography>
          </Box>
          <IconButton
            size="small"
            onClick={onClose}
            aria-label="Close detail panel"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      <Box className={classes.setupBody}>
        <Typography variant="body2" color="textSecondary">
          {description}
        </Typography>

        <Box mt="auto" pt={2} display="flex" justifyContent="flex-end">
          <Tooltip
            title={!canPromote && !loading ? deniedTooltip : ''}
            disableHoverListener={canPromote || loading}
          >
            <span>
              <Button
                variant="contained"
                color="primary"
                disabled={
                  !latest || onLatest || isDeploying || loading || !canPromote
                }
                onClick={() => latest && void onPromote(targetEnv, latest)}
              >
                {isDeploying
                  ? 'Deploying...'
                  : `Deploy to ${firstEnvironment.name}`}
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
};
