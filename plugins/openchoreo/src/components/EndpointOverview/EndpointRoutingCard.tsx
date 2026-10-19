import { Box, Chip, LinearProgress, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { EntityRefLink, useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { Card } from '@openchoreo/backstage-design-system';
import { useDataplaneOverviewStyles } from '../DataplaneOverview/styles';

const useStyles = makeStyles(theme => ({
  section: {
    marginTop: theme.spacing(2),
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
  },
  backend: {
    padding: theme.spacing(1, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
    '&:last-child': {
      borderBottom: 'none',
    },
  },
  backendHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: theme.spacing(1),
  },
  share: {
    marginTop: theme.spacing(0.5),
    height: 6,
    borderRadius: 3,
  },
}));

/** One backend as ingested onto the Endpoint entity's spec.backends. */
export interface EndpointBackend {
  name: string;
  kind?: string;
  component?: string;
  endpoint?: string;
  weight?: number;
}

/**
 * Share of traffic each backend receives. A backend without a weight counts
 * as 1, the CRD default, and a total of 0 sends nothing anywhere.
 */
export function trafficShares(backends: EndpointBackend[]): number[] {
  const weights = backends.map(b => b.weight ?? 1);
  const total = weights.reduce((sum, w) => sum + w, 0);
  return weights.map(w => (total > 0 ? (w / total) * 100 : 0));
}

function formatShare(share: number): string {
  return Number.isInteger(share) ? `${share}%` : `${share.toFixed(1)}%`;
}

/**
 * Overview card showing how an Endpoint routes: the (Cluster)EndpointType that
 * renders it, the scopes it is exposed to, and the backends it splits traffic
 * across. Reads the catalog entity only; per-environment resolution lives on
 * the Deploy tab.
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
  const shares = trafficShares(backends);
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
          backends.map((backend, i) => (
            <Box key={backend.name} className={ownClasses.backend}>
              <Box className={ownClasses.backendHeader}>
                <Typography variant="body2" component="div">
                  {backend.component ? (
                    <EntityRefLink
                      entityRef={{
                        kind: 'component',
                        namespace,
                        name: backend.component,
                      }}
                    />
                  ) : (
                    backend.name
                  )}
                  {backend.endpoint && (
                    <Typography
                      variant="body2"
                      color="textSecondary"
                      component="span"
                    >
                      {` / ${backend.endpoint}`}
                    </Typography>
                  )}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {formatShare(shares[i])}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={shares[i]}
                className={ownClasses.share}
                aria-label={`${backend.name} traffic share`}
              />
            </Box>
          ))
        )}
      </Box>
    </Card>
  );
};
