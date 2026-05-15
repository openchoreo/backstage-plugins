import { useEffect, useState } from 'react';
import { Box, Chip, Typography } from '@material-ui/core';
import { Progress } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Card } from '@openchoreo/backstage-design-system';
import {
  openChoreoClientApiRef,
  type ResourceReleaseBinding,
} from '../../api/OpenChoreoClientApi';
import { useDataplaneOverviewStyles } from '../DataplaneOverview/styles';

type Status = ResourceReleaseBinding['status'];

const statusChipClass = (status: Status, classes: Record<string, string>) => {
  switch (status) {
    case 'Ready':
      return classes.statusHealthy;
    case 'NotReady':
      return classes.statusWarning;
    case 'Failed':
      return classes.statusError;
    default:
      return classes.statusLabel;
  }
};

/**
 * Per-environment summary of the bindings that target this Resource. Each
 * row shows the environment, the currently pinned ResourceRelease, and
 * the binding's aggregate Ready condition derived from openchoreo-api.
 */
export const ResourceBindingsCard = () => {
  const classes = useDataplaneOverviewStyles();
  const { entity } = useEntity();
  const client = useApi(openChoreoClientApiRef);

  const [bindings, setBindings] = useState<ResourceReleaseBinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    client
      .fetchResourceReleaseBindings(entity)
      .then(res => {
        if (cancelled) return;
        setBindings(res?.data?.items ?? []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, entity]);

  return (
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">Environments</Typography>
      </Box>

      {loading && <Progress />}

      {!loading && error && (
        <Typography className={classes.statusValue} color="error">
          Failed to load bindings: {error.message}
        </Typography>
      )}

      {!loading && !error && bindings.length === 0 && (
        <Typography className={classes.statusValue}>
          No environment bindings yet.
        </Typography>
      )}

      {!loading && !error && bindings.length > 0 && (
        <Box>
          {bindings.map(b => (
            <Box key={b.name} className={classes.infoRow}>
              <Typography className={classes.infoLabel}>
                {b.environment}
              </Typography>
              <Box display="flex" alignItems="center" gridGap={8} flex={1}>
                <Typography className={classes.infoValue}>
                  {b.releaseName || 'unpinned'}
                </Typography>
                {b.status && (
                  <Chip
                    label={b.status}
                    size="small"
                    className={statusChipClass(b.status, classes)}
                  />
                )}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Card>
  );
};
