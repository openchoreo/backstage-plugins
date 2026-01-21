import { Box, Typography } from '@material-ui/core';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import LockIcon from '@material-ui/icons/Lock';
import TimelineIcon from '@material-ui/icons/Timeline';
import clsx from 'clsx';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Link } from '@backstage/core-components';
import { Card } from '@openchoreo/backstage-design-system';
import { useDeploymentPipelineOverviewStyles } from './styles';

interface EnvironmentInfo {
  name: string;
  requiresApproval: boolean;
}

export const DeploymentPipelineVisualization = () => {
  const classes = useDeploymentPipelineOverviewStyles();
  const { entity } = useEntity();

  const spec = entity.spec as any;
  const promotionPaths = spec?.promotionPaths || [];

  // Build ordered list of environments from promotion paths
  const buildEnvironmentOrder = (): EnvironmentInfo[] => {
    if (!promotionPaths || promotionPaths.length === 0) {
      return [];
    }

    const envMap = new Map<string, EnvironmentInfo>();
    const edges: [string, string, boolean][] = []; // [source, target, requiresApproval]

    // Collect all edges and environments
    for (const path of promotionPaths) {
      const source = path.sourceEnvironment;
      if (source && !envMap.has(source)) {
        envMap.set(source, { name: source, requiresApproval: false });
      }

      for (const target of path.targetEnvironments || []) {
        if (target.name && !envMap.has(target.name)) {
          envMap.set(target.name, {
            name: target.name,
            requiresApproval:
              target.requiresApproval ||
              target.isManualApprovalRequired ||
              false,
          });
        }
        if (source && target.name) {
          edges.push([
            source,
            target.name,
            target.requiresApproval || target.isManualApprovalRequired || false,
          ]);
        }
      }
    }

    // Find root nodes (sources that are not targets)
    const targets = new Set(edges.map(e => e[1]));
    const roots = [...envMap.keys()].filter(e => !targets.has(e));

    // BFS to order environments
    const ordered: EnvironmentInfo[] = [];
    const visited = new Set<string>();
    const queue =
      roots.length > 0 ? [...roots] : [...envMap.keys()].slice(0, 1);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const env = envMap.get(current);
      if (env) {
        ordered.push(env);
      }

      // Find targets of this environment
      for (const [src, tgt, approval] of edges) {
        if (src === current && !visited.has(tgt)) {
          // Update approval status on target
          const targetEnv = envMap.get(tgt);
          if (targetEnv) {
            targetEnv.requiresApproval = approval;
          }
          queue.push(tgt);
        }
      }
    }

    // Add any remaining environments not yet visited
    for (const [name, env] of envMap) {
      if (!visited.has(name)) {
        ordered.push(env);
      }
    }

    return ordered;
  };

  const environments = buildEnvironmentOrder();

  const getChipClass = (envName: string): string => {
    const lowerName = envName.toLowerCase();
    if (lowerName.includes('prod')) {
      return classes.productionChip;
    }
    if (lowerName.includes('stag')) {
      return classes.stagingChip;
    }
    if (lowerName.includes('dev')) {
      return classes.devChip;
    }
    return classes.defaultChip;
  };

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
            key={env.name}
            style={{ display: 'flex', alignItems: 'center', gap: '16px' }}
          >
            <Box className={classes.environmentNode}>
              <Link
                to={`/catalog/default/environment/${env.name}`}
                style={{ textDecoration: 'none' }}
              >
                <Typography
                  className={clsx(
                    classes.environmentChip,
                    getChipClass(env.name),
                  )}
                >
                  {capitalizeFirst(env.name)}
                </Typography>
              </Link>
            </Box>

            {index < environments.length - 1 && (
              <Box className={classes.arrowWithLock}>
                <ArrowForwardIcon className={classes.arrow} />
                {environments[index + 1]?.requiresApproval && (
                  <LockIcon className={classes.lockIcon} />
                )}
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Card>
  );
};
