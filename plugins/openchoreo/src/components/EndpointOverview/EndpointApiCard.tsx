import { Box, Typography } from '@material-ui/core';
import { EntityRefLink, useEntity } from '@backstage/plugin-catalog-react';
import { parseEntityRef } from '@backstage/catalog-model';
import { Card } from '@openchoreo/backstage-design-system';
import { useDataplaneOverviewStyles } from '../DataplaneOverview/styles';

/**
 * Overview card linking an Endpoint to the API entity that carries its
 * schema. The catalog creates that entity only when the Endpoint declares
 * spec.schema.
 */
export const EndpointApiCard = () => {
  const classes = useDataplaneOverviewStyles();
  const { entity } = useEntity();
  const providesApi = (entity.spec as { providesApi?: string } | undefined)
    ?.providesApi;

  return (
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">API</Typography>
      </Box>
      {providesApi ? (
        <Box className={classes.infoRow}>
          <Typography className={classes.infoLabel}>Definition</Typography>
          <Typography className={classes.infoValue} component="div">
            <EntityRefLink
              entityRef={parseEntityRef(providesApi, {
                defaultKind: 'api',
                defaultNamespace: entity.metadata.namespace ?? 'default',
              })}
            />
          </Typography>
        </Box>
      ) : (
        <Typography className={classes.statusValue}>
          This endpoint declares no schema, so it has no API definition.
        </Typography>
      )}
    </Card>
  );
};
