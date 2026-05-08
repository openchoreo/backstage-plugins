import { useMemo } from 'react';
import { Box, Typography } from '@material-ui/core';
import TimelineIcon from '@material-ui/icons/Timeline';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Card } from '@openchoreo/backstage-design-system';
import {
  PipelineFlowVisualization,
  type PipelinePromotionPath,
} from '@openchoreo/backstage-plugin-react';
import { useDeploymentPipelineOverviewStyles } from './styles';

interface RawPromotionPath {
  sourceEnvironment?: string;
  sourceEnvironmentRef?: string | { name?: string };
  targetEnvironments?: Array<{
    name: string;
    requiresApproval?: boolean;
    isManualApprovalRequired?: boolean;
  }>;
  targetEnvironmentRefs?: Array<{
    name: string;
    requiresApproval?: boolean;
    isManualApprovalRequired?: boolean;
  }>;
}

export const DeploymentPipelineVisualization = () => {
  const classes = useDeploymentPipelineOverviewStyles();
  const { entity } = useEntity();

  const spec = entity.spec as
    | { promotionPaths?: RawPromotionPath[] }
    | undefined;
  const namespace = entity.metadata.namespace || 'default';

  const { environments, promotionPaths } = useMemo(() => {
    const rawPaths = spec?.promotionPaths ?? [];

    const normalized = rawPaths.map(path => {
      const source =
        path.sourceEnvironment ??
        (typeof path.sourceEnvironmentRef === 'string'
          ? path.sourceEnvironmentRef
          : path.sourceEnvironmentRef?.name) ??
        '';
      const rawTargets =
        path.targetEnvironments ?? path.targetEnvironmentRefs ?? [];
      const targets = rawTargets
        .filter(t => !!t.name)
        .map(t => ({
          name: t.name,
          requiresApproval: t.requiresApproval ?? t.isManualApprovalRequired,
        }));
      return { source, targets };
    });

    // Build ordered env list for the chip-strip fallback (linear pipelines).
    const envOrder: string[] = [];
    const visited = new Set<string>();
    const allTargets = new Set<string>();
    for (const path of normalized) {
      for (const target of path.targets) allTargets.add(target.name);
    }
    for (const path of normalized) {
      if (
        path.source &&
        !allTargets.has(path.source) &&
        !visited.has(path.source)
      ) {
        envOrder.push(path.source);
        visited.add(path.source);
      }
    }
    for (const path of normalized) {
      if (path.source && !visited.has(path.source)) {
        envOrder.push(path.source);
        visited.add(path.source);
      }
      for (const target of path.targets) {
        if (!visited.has(target.name)) {
          envOrder.push(target.name);
          visited.add(target.name);
        }
      }
    }

    const paths: PipelinePromotionPath[] = normalized
      .filter(p => p.source && p.targets.length > 0)
      .map(p => ({ source: p.source, targets: p.targets }));

    return { environments: envOrder, promotionPaths: paths };
  }, [spec]);

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
      <PipelineFlowVisualization
        environments={environments}
        promotionPaths={promotionPaths}
        environmentNamespace={namespace}
      />
    </Card>
  );
};
