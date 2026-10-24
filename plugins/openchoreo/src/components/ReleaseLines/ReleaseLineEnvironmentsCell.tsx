import Box from '@material-ui/core/Box';
import Chip from '@material-ui/core/Chip';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import CheckCircleIcon from '@material-ui/icons/CheckCircleOutlined';
import WarningIcon from '@material-ui/icons/ReportProblemOutlined';
import type { ReleaseLineEnvironmentSummary } from '@openchoreo/backstage-plugin-common';
import { useProjectContentsCardStyles } from '../Projects/ProjectContentsCard/styles';

const MAX_VISIBLE_CHIPS = 3;

const statusText = (env: ReleaseLineEnvironmentSummary) =>
  env.ready ? 'Deployed (Ready)' : 'Deployed (NotReady)';

export interface ReleaseLineEnvironmentsCellProps {
  environments: ReleaseLineEnvironmentSummary[];
}

/**
 * The environments a release line is deployed to, with the same chips as the
 * deployment column of the project's contents table.
 */
export function ReleaseLineEnvironmentsCell({
  environments,
}: ReleaseLineEnvironmentsCellProps) {
  const classes = useProjectContentsCardStyles();

  if (environments.length === 0) {
    return (
      <Typography variant="body2" className={classes.notDeployed}>
        —
      </Typography>
    );
  }

  const visible = environments.slice(0, MAX_VISIBLE_CHIPS);
  const hidden = environments.slice(MAX_VISIBLE_CHIPS);

  return (
    <Box className={classes.deploymentStatus}>
      {visible.map(env => {
        const StatusIcon = env.ready ? CheckCircleIcon : WarningIcon;
        return (
          <Tooltip
            key={env.environment}
            title={`${env.environment}: ${statusText(env)}`}
          >
            <Box className={classes.chipContainer}>
              <Chip
                size="small"
                className={classes.environmentChip}
                label={
                  <Box display="flex" alignItems="center" gridGap={1}>
                    <Typography variant="body2">{env.environment}</Typography>
                    <StatusIcon
                      className={
                        env.ready
                          ? classes.statusIconReady
                          : classes.statusIconWarning
                      }
                      fontSize="small"
                    />
                  </Box>
                }
                color="default"
                variant="outlined"
              />
            </Box>
          </Tooltip>
        );
      })}
      {hidden.length > 0 && (
        <Tooltip
          title={
            <Box>
              {hidden.map(env => (
                <Typography
                  key={env.environment}
                  variant="caption"
                  display="block"
                >
                  {env.environment}: {statusText(env)}
                </Typography>
              ))}
            </Box>
          }
        >
          <Chip
            size="small"
            className={classes.moreChip}
            label={`+${hidden.length} more`}
            variant="outlined"
          />
        </Tooltip>
      )}
    </Box>
  );
}
