import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button } from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import TimelineIcon from '@material-ui/icons/Timeline';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import clsx from 'clsx';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { Link } from '@backstage/core-components';
import { Card } from '@openchoreo/backstage-design-system';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useEnvironmentOverviewStyles } from './styles';

interface PipelinePosition {
  pipelineName: string;
  pipelineEntityRef?: string;
  environments: string[];
  currentIndex: number;
}

export const EnvironmentPromotionCard = () => {
  const classes = useEnvironmentOverviewStyles();
  const { entity } = useEntity();
  const catalogApi = useApi(catalogApiRef);

  const [pipelinePosition, setPipelinePosition] =
    useState<PipelinePosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const environmentName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ENVIRONMENT] ||
    entity.metadata.name;
  const organization =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];

  const fetchPipelinePosition = useCallback(async () => {
    if (!organization || !environmentName) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Find DeploymentPipeline entities that reference this environment
      const { items: pipelineEntities } = await catalogApi.getEntities({
        filter: {
          kind: 'DeploymentPipeline',
        },
      });

      // Find a pipeline that includes this environment
      for (const pipeline of pipelineEntities) {
        const spec = pipeline.spec as any;
        if (!spec?.promotionPaths) continue;

        const allEnvironments = new Set<string>();
        for (const path of spec.promotionPaths) {
          if (path.sourceEnvironment) {
            allEnvironments.add(path.sourceEnvironment);
          }
          for (const target of path.targetEnvironments || []) {
            if (target.name) {
              allEnvironments.add(target.name);
            }
          }
        }

        // Check if this environment is in the pipeline
        if (allEnvironments.has(environmentName)) {
          // Build ordered environment list from promotion paths
          const envOrder: string[] = [];
          const visited = new Set<string>();

          // Find the starting environment (one that's only a source, not a target)
          const targets = new Set<string>();
          for (const path of spec.promotionPaths) {
            for (const target of path.targetEnvironments || []) {
              targets.add(target.name);
            }
          }

          // Start with environments that are sources but not targets
          for (const path of spec.promotionPaths) {
            if (
              path.sourceEnvironment &&
              !targets.has(path.sourceEnvironment) &&
              !visited.has(path.sourceEnvironment)
            ) {
              envOrder.push(path.sourceEnvironment);
              visited.add(path.sourceEnvironment);
            }
          }

          // Add remaining environments in order
          for (const path of spec.promotionPaths) {
            if (
              path.sourceEnvironment &&
              !visited.has(path.sourceEnvironment)
            ) {
              envOrder.push(path.sourceEnvironment);
              visited.add(path.sourceEnvironment);
            }
            for (const target of path.targetEnvironments || []) {
              if (!visited.has(target.name)) {
                envOrder.push(target.name);
                visited.add(target.name);
              }
            }
          }

          const currentIndex = envOrder.findIndex(
            e => e.toLowerCase() === environmentName.toLowerCase(),
          );

          setPipelinePosition({
            pipelineName: pipeline.metadata.title || pipeline.metadata.name,
            pipelineEntityRef: `deploymentpipeline:${
              pipeline.metadata.namespace || 'default'
            }/${pipeline.metadata.name}`,
            environments: envOrder,
            currentIndex,
          });
          break;
        }
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [organization, environmentName, catalogApi]);

  useEffect(() => {
    fetchPipelinePosition();
  }, [fetchPipelinePosition]);

  if (loading) {
    return (
      <Card padding={24} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Skeleton variant="text" width={180} height={28} />
        </Box>
        <Skeleton variant="text" width="100%" height={24} />
        <Skeleton variant="text" width="80%" height={24} />
      </Card>
    );
  }

  if (error || !pipelinePosition) {
    return (
      <Card padding={24} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Typography className={classes.cardTitle}>
            Promotion Pipeline
          </Typography>
        </Box>
        <Box className={classes.emptyState}>
          <TimelineIcon className={classes.emptyIcon} />
          <Typography variant="body2">
            {error
              ? 'Failed to load pipeline data'
              : 'No deployment pipeline configured for this environment'}
          </Typography>
        </Box>
      </Card>
    );
  }

  const capitalizeFirst = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  // Convert entity ref (kind:namespace/name) to catalog URL (/catalog/namespace/kind/name)
  const entityRefToUrl = (entityRef: string): string => {
    // Format: deploymentpipeline:namespace/name
    const colonIndex = entityRef.indexOf(':');
    if (colonIndex === -1) return `/catalog/default/${entityRef}`;

    const kind = entityRef.substring(0, colonIndex);
    const rest = entityRef.substring(colonIndex + 1);
    const slashIndex = rest.indexOf('/');

    if (slashIndex === -1) {
      return `/catalog/default/${kind}/${rest}`;
    }

    const namespace = rest.substring(0, slashIndex);
    const name = rest.substring(slashIndex + 1);
    return `/catalog/${namespace}/${kind}/${name}`;
  };

  return (
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">Promotion Pipeline</Typography>
      </Box>

      <Box className={classes.content}>
        <Box className={classes.infoRow}>
          <Typography className={classes.infoLabel}>Pipeline:</Typography>
          <Typography className={classes.infoValue}>
            {pipelinePosition.pipelineName}
          </Typography>
        </Box>

        <Box className={classes.pipelineFlow}>
          {pipelinePosition.environments.map((env, index) => {
            const isCurrentEnv = index === pipelinePosition.currentIndex;
            const chipContent = (
              <Typography
                className={clsx(
                  classes.environmentChip,
                  isCurrentEnv
                    ? classes.currentEnvironment
                    : classes.otherEnvironment,
                )}
              >
                {capitalizeFirst(env)}
              </Typography>
            );

            return (
              <Box
                key={env}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {isCurrentEnv ? (
                  chipContent
                ) : (
                  <Link
                    to={`/catalog/default/environment/${env.toLowerCase()}`}
                    style={{ textDecoration: 'none' }}
                  >
                    {chipContent}
                  </Link>
                )}
                {index < pipelinePosition.environments.length - 1 && (
                  <ArrowForwardIcon className={classes.arrow} />
                )}
              </Box>
            );
          })}
        </Box>

        {pipelinePosition.pipelineEntityRef && (
          <Link
            to={entityRefToUrl(pipelinePosition.pipelineEntityRef)}
            style={{ textDecoration: 'none' }}
          >
            <Button
              variant="text"
              color="primary"
              size="small"
              className={classes.linkButton}
            >
              View Pipeline Details
            </Button>
          </Link>
        )}
      </Box>
    </Card>
  );
};
