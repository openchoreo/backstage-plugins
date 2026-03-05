import { useCallback, useEffect, useState } from 'react';
import { Box, Typography, IconButton, Tooltip } from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import RefreshIcon from '@material-ui/icons/Refresh';
import LaunchIcon from '@material-ui/icons/Launch';
import StorageIcon from '@material-ui/icons/Storage';
import BuildIcon from '@material-ui/icons/Build';
import CloudOffIcon from '@material-ui/icons/CloudOff';
import { useEntity } from '@backstage/plugin-catalog-react';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { Link } from '@backstage/core-components';
import { Card } from '@openchoreo/backstage-design-system';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useDataplaneOverviewStyles } from '../DataplaneOverview/styles';

interface LinkedPlane {
  name: string;
  kind: string;
  namespace: string;
  displayName?: string;
}

export const ClusterObservabilityPlaneLinkedPlanesCard = () => {
  const classes = useDataplaneOverviewStyles();
  const { entity } = useEntity();
  const catalogApi = useApi(catalogApiRef);

  const [linkedPlanes, setLinkedPlanes] = useState<LinkedPlane[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const planeName = entity.metadata.name;

  const fetchLinkedPlanes = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);

      // Query catalog for ClusterDataplane and ClusterBuildPlane entities with matching observability-plane-ref annotation
      const [dataplaneResult, buildplaneResult] = await Promise.all([
        catalogApi.getEntities({
          filter: { kind: 'ClusterDataplane' },
        }),
        catalogApi.getEntities({
          filter: { kind: 'ClusterBuildPlane' },
        }),
      ]);

      const planes: LinkedPlane[] = [];

      const matchesRef = (e: Entity) => {
        const ref =
          e.metadata.annotations?.[CHOREO_ANNOTATIONS.OBSERVABILITY_PLANE_REF];
        return ref === planeName;
      };

      dataplaneResult.items.filter(matchesRef).forEach(dp => {
        planes.push({
          name: dp.metadata.name,
          kind: 'ClusterDataplane',
          namespace: dp.metadata.namespace || 'openchoreo-cluster',
          displayName: dp.metadata.title || dp.metadata.name,
        });
      });

      buildplaneResult.items.filter(matchesRef).forEach(bp => {
        planes.push({
          name: bp.metadata.name,
          kind: 'ClusterBuildPlane',
          namespace: bp.metadata.namespace || 'openchoreo-cluster',
          displayName: bp.metadata.title || bp.metadata.name,
        });
      });

      setLinkedPlanes(planes);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [catalogApi, planeName]);

  useEffect(() => {
    fetchLinkedPlanes();
  }, [fetchLinkedPlanes]);

  if (loading) {
    return (
      <Card padding={24} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Skeleton variant="text" width={180} height={28} />
        </Box>
        <ul className={classes.environmentList}>
          {[1, 2].map(i => (
            <li key={i} className={classes.environmentItem}>
              <Skeleton variant="text" width="100%" height={40} />
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  if (error) {
    return (
      <Card padding={24} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Typography variant="h5">Linked Planes</Typography>
        </Box>
        <Box className={classes.emptyState}>
          <CloudOffIcon className={classes.emptyIcon} />
          <Typography variant="body2" color="error">
            Failed to load linked planes
          </Typography>
        </Box>
      </Card>
    );
  }

  if (linkedPlanes.length === 0) {
    return (
      <Card padding={24} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Typography variant="h5">Linked Planes</Typography>
        </Box>
        <Box className={classes.emptyState}>
          <CloudOffIcon className={classes.emptyIcon} />
          <Typography variant="body2">
            No cluster data planes or cluster build planes linked to this
            observability plane
          </Typography>
        </Box>
      </Card>
    );
  }

  return (
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">Linked Planes</Typography>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={fetchLinkedPlanes}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <ul className={classes.environmentList}>
        {linkedPlanes.map(plane => (
          <li
            key={`${plane.kind}-${plane.namespace}-${plane.name}`}
            className={classes.environmentItem}
          >
            <Box className={classes.environmentInfo}>
              {plane.kind === 'ClusterDataplane' ? (
                <StorageIcon style={{ fontSize: '1.2rem', color: 'inherit' }} />
              ) : (
                <BuildIcon style={{ fontSize: '1.2rem', color: 'inherit' }} />
              )}
              <Box>
                <Link
                  to={`/catalog/${
                    plane.namespace
                  }/${plane.kind.toLowerCase()}/${plane.name}`}
                  className={classes.environmentName}
                >
                  {plane.displayName || plane.name}
                </Link>
                <Typography
                  variant="caption"
                  color="textSecondary"
                  style={{ display: 'block' }}
                >
                  {plane.namespace}
                </Typography>
              </Box>
              <Typography
                className={classes.environmentType}
                style={{
                  backgroundColor: 'rgba(0,0,0,0.08)',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: '0.75rem',
                }}
              >
                {plane.kind === 'ClusterDataplane'
                  ? 'Cluster Data Plane'
                  : 'Cluster Build Plane'}
              </Typography>
            </Box>

            <Tooltip title={`View ${plane.kind}`}>
              <IconButton
                size="small"
                component={Link}
                to={`/catalog/${plane.namespace}/${plane.kind.toLowerCase()}/${
                  plane.name
                }`}
              >
                <LaunchIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </li>
        ))}
      </ul>
    </Card>
  );
};
