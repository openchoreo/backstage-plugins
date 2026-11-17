import { Box, Chip, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { EntityRefLink, useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { Card } from '@openchoreo/backstage-design-system';
import { useDataplaneOverviewStyles } from '../DataplaneOverview/styles';
import {
  EndpointBackendList,
  type EndpointBackend,
} from './EndpointBackendList';

export { trafficShares, type EndpointBackend } from './EndpointBackendList';

const useStyles = makeStyles(theme => ({
  section: {
    marginTop: theme.spacing(2),
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
  },
}));

/**
 * Overview card showing how an Endpoint routes: the (Cluster)EndpointType that
 * renders it, the scopes it is exposed to, and the backends it splits traffic
 * across. Reads the catalog entity only and changes nothing: backends are
 * managed from the Set up card on the Deploy tab, where each change becomes a
 * release to deploy.
 */
export const EndpointRoutingCard = () => {
  const classes = useDataplaneOverviewStyles();
  const ownClasses = useStyles();
  const { entity } = useEntity();

  const annotations = entity.metadata.annotations ?? {};
  const typeName = annotations[CHOREO_ANNOTATIONS.ENDPOINTTYPE];
  const isClusterType =
    annotations[CHOREO_ANNOTATIONS.ENDPOINTTYPE_KIND] === 'ClusterEndpointType';
  const spec = (entity.spec ?? {}) as {
    visibility?: string[];
    backends?: EndpointBackend[];
  };
  const visibility = spec.visibility ?? [];
  const backends = spec.backends ?? [];
  const namespace = entity.metadata.namespace ?? 'default';

  return (
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">Routing</Typography>
      </Box>

      <Box className={classes.infoRow}>
        <Typography className={classes.infoLabel}>Type</Typography>
        <Typography className={classes.infoValue} component="div">
          {typeName ? (
            <EntityRefLink
              entityRef={{
                kind: isClusterType ? 'clusterendpointtype' : 'endpointtype',
                namespace: isClusterType ? 'openchoreo-cluster' : namespace,
                name: typeName,
              }}
            />
          ) : (
            '—'
          )}
        </Typography>
      </Box>

      <Box className={classes.infoRow}>
        <Typography className={classes.infoLabel}>Visibility</Typography>
        <Box className={ownClasses.chips}>
          {visibility.length === 0 ? (
            <Typography className={classes.infoValue}>—</Typography>
          ) : (
            visibility.map(v => (
              <Chip key={v} size="small" label={v} variant="outlined" />
            ))
          )}
        </Box>
      </Box>

      <Box className={ownClasses.section}>
        <Typography variant="subtitle2">
          Backends ({backends.length})
        </Typography>
        {backends.length === 0 ? (
          <Typography className={classes.statusValue}>
            No backends configured.
          </Typography>
        ) : (
          <EndpointBackendList backends={backends} namespace={namespace} />
        )}
      </Box>
    </Card>
  );
};
