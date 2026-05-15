import { useEffect, useState } from 'react';
import { Box, Typography } from '@material-ui/core';
import { Progress, Link } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import {
  catalogApiRef,
  useEntity,
} from '@backstage/plugin-catalog-react';
import { stringifyEntityRef, type Entity } from '@backstage/catalog-model';
import { Card } from '@openchoreo/backstage-design-system';
import { useDataplaneOverviewStyles } from '../DataplaneOverview/styles';

/**
 * Lists Components whose workload declares this Resource under
 * `dependencies.resources[]`. Backed by Backstage's relation index: the
 * Component translator populates `spec.dependsOn`, the catalog emits
 * a `dependsOn` relation, and this card queries the inverse via
 * `relations.dependson`.
 */
export const ConsumingComponentsCard = () => {
  const classes = useDataplaneOverviewStyles();
  const { entity } = useEntity();
  const catalogApi = useApi(catalogApiRef);

  const [components, setComponents] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const ref = stringifyEntityRef(entity);

    catalogApi
      .getEntities({
        filter: { kind: 'Component', 'relations.dependson': ref },
      })
      .then(res => {
        if (cancelled) return;
        setComponents(res?.items ?? []);
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
  }, [catalogApi, entity]);

  const componentLink = (component: Entity) => {
    const ns = component.metadata.namespace ?? 'default';
    const name = component.metadata.name;
    return `/catalog/${ns}/component/${name}`;
  };

  return (
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">Consuming Components</Typography>
      </Box>

      {loading && <Progress />}

      {!loading && error && (
        <Typography className={classes.statusValue} color="error">
          Failed to load consuming components: {error.message}
        </Typography>
      )}

      {!loading && !error && components.length === 0 && (
        <Typography className={classes.statusValue}>
          No components currently depend on this resource.
        </Typography>
      )}

      {!loading && !error && components.length > 0 && (
        <Box>
          {components.map(c => (
            <Box
              key={`${c.metadata.namespace}/${c.metadata.name}`}
              className={classes.infoRow}
            >
              <Typography className={classes.infoValue}>
                <Link to={componentLink(c)}>
                  {c.metadata.title || c.metadata.name}
                </Link>
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Card>
  );
};
