import { useEffect, useState } from 'react';
import { Box, Chip, Typography } from '@material-ui/core';
import { Link } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef, useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef, type Entity } from '@backstage/catalog-model';
import { Card, PageLoader } from '@openchoreo/backstage-design-system';
import { useDataplaneOverviewStyles } from '../DataplaneOverview/styles';
import { useOverviewCardStyles } from '../Environments/OverviewCard/styles';

const MAX_CHIP_AREA_HEIGHT = 200;

/**
 * Lists Components whose workload declares this Resource under
 * `dependencies.resources[]`. Backed by Backstage's relation index: the
 * Component translator populates `spec.dependsOn`, the catalog emits
 * a `dependsOn` relation, and this card queries the inverse via
 * `relations.dependson`.
 */
export const ConsumingComponentsCard = () => {
  const classes = useDataplaneOverviewStyles();
  const chipClasses = useOverviewCardStyles();
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

  const headerText =
    !loading && !error
      ? `Consuming Components (${components.length})`
      : 'Consuming Components';

  return (
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">{headerText}</Typography>
      </Box>

      {loading && <PageLoader minHeight={120} />}

      {!loading && error && (
        <Typography className={classes.statusValue} color="error">
          Failed to load consuming components: {error.message}
        </Typography>
      )}

      {!loading && !error && components.length === 0 && (
        <Typography className={classes.statusValue}>
          No consuming components.
        </Typography>
      )}

      {!loading && !error && components.length > 0 && (
        <Box
          className={chipClasses.environmentChips}
          style={{ maxHeight: MAX_CHIP_AREA_HEIGHT, overflowY: 'auto' }}
        >
          {components.map(c => {
            const name = c.metadata.title || c.metadata.name;
            return (
              <Link
                key={`${c.metadata.namespace}/${c.metadata.name}`}
                to={componentLink(c)}
                style={{ textDecoration: 'none' }}
              >
                <Chip
                  size="small"
                  clickable
                  label={name}
                  variant="outlined"
                  style={{ height: 24, fontWeight: 500 }}
                />
              </Link>
            );
          })}
        </Box>
      )}
    </Card>
  );
};
