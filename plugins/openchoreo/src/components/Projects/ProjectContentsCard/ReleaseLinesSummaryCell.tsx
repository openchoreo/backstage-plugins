import { Box, Tooltip, Typography } from '@material-ui/core';
import { type ReleaseLineDeployments } from '../hooks';
import { useProjectContentsCardStyles } from './styles';

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * Deployment column of a component with release lines: how many lines it has
 * and how many deployments they make in total. Per-environment chips don't
 * fit, as one environment can run several lines; the tooltip lists where each
 * line runs, and the component's Overview has the details.
 */
export const ReleaseLinesSummaryCell = ({
  releaseLines,
}: {
  releaseLines: ReleaseLineDeployments[];
}) => {
  const classes = useProjectContentsCardStyles();
  const deployments = releaseLines.reduce(
    (total, line) => total + line.environments.length,
    0,
  );

  return (
    <Tooltip
      title={
        releaseLines.length === 0 ? (
          'No release lines yet'
        ) : (
          <Box>
            {releaseLines.map(line => (
              <Typography key={line.name} variant="caption" display="block">
                {line.name}:{' '}
                {line.environments.length > 0
                  ? line.environments.join(', ')
                  : 'not deployed'}
              </Typography>
            ))}
          </Box>
        )
      }
    >
      <Typography variant="body2" className={classes.releaseLinesSummary}>
        {plural(releaseLines.length, 'release line')} ·{' '}
        {plural(deployments, 'deployment')}
      </Typography>
    </Tooltip>
  );
};
