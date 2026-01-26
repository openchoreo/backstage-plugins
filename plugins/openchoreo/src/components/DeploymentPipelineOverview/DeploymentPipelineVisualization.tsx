import { Box, Typography } from '@material-ui/core';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import TimelineIcon from '@material-ui/icons/Timeline';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Link } from '@backstage/core-components';
import { Card } from '@openchoreo/backstage-design-system';
import { useDeploymentPipelineOverviewStyles } from './styles';

export const DeploymentPipelineVisualization = () => {
  const classes = useDeploymentPipelineOverviewStyles();
  const { entity } = useEntity();

  const spec = entity.spec as any;
  const promotionPaths = spec?.promotionPaths || [];

  // Build ordered list of environments from promotion paths
  const buildEnvironmentOrder = (): string[] => {
    if (!promotionPaths || promotionPaths.length === 0) {
      return [];
    }

    const envSet = new Set<string>();
    const edges: [string, string][] = [];

    // Collect all edges and environments
    for (const path of promotionPaths) {
      const source = path.sourceEnvironment;
      if (source) {
        envSet.add(source);
      }

      for (const target of path.targetEnvironments || []) {
        if (target.name) {
          envSet.add(target.name);
          if (source) {
            edges.push([source, target.name]);
          }
        }
      }
    }

    // Find root nodes (sources that are not targets)
    const targets = new Set(edges.map(e => e[1]));
    const roots = [...envSet].filter(e => !targets.has(e));

    // BFS to order environments
    const ordered: string[] = [];
    const visited = new Set<string>();
    const queue = roots.length > 0 ? [...roots] : [...envSet].slice(0, 1);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      ordered.push(current);

      // Find targets of this environment
      for (const [src, tgt] of edges) {
        if (src === current && !visited.has(tgt)) {
          queue.push(tgt);
        }
      }
    }

    // Add any remaining environments not yet visited
    for (const env of envSet) {
      if (!visited.has(env)) {
        ordered.push(env);
      }
    }

    return ordered;
  };

  const environments = buildEnvironmentOrder();

  const capitalizeFirst = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  if (environments.length === 0) {
    return (
      <Card padding={24} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Typography className={classes.cardTitle}>
            Pipeline Visualization
          </Typography>
        </Box>
        <Box className={classes.emptyState}>
          <TimelineIcon className={classes.emptyIcon} />
          <Typography variant="body2">No promotion paths configured</Typography>
        </Box>
      </Card>
    );
  }

  return (
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">Pipeline Visualization</Typography>
      </Box>

      <Box className={classes.pipelineVisualization}>
        {environments.map((env, index) => (
          <Box
            key={env}
            style={{ display: 'flex', alignItems: 'center', gap: '16px' }}
          >
            <Box className={classes.environmentNode}>
              <Link
                to={`/catalog/default/environment/${env}`}
                style={{ textDecoration: 'none' }}
              >
                <Typography
                  className={`${classes.environmentChip} ${classes.environmentChipDefault}`}
                >
                  {capitalizeFirst(env)}
                </Typography>
              </Link>
            </Box>

            {index < environments.length - 1 && (
              <ArrowForwardIcon className={classes.arrow} />
            )}
          </Box>
        ))}
      </Box>
    </Card>
  );
};
