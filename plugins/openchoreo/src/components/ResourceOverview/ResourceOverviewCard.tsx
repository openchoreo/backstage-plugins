import { Box, Chip, Typography } from '@material-ui/core';
import CategoryIcon from '@material-ui/icons/Category';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Link } from '@backstage/core-components';
import { Card } from '@openchoreo/backstage-design-system';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useDataplaneOverviewStyles } from '../DataplaneOverview/styles';

/**
 * Resource Overview card. Shows the type the Resource references, its
 * parameters, and creation metadata. Pure entity-driven; no API calls.
 */
export const ResourceOverviewCard = () => {
  const classes = useDataplaneOverviewStyles();
  const { entity } = useEntity();

  const annotations = entity.metadata.annotations || {};
  const typeName = annotations[CHOREO_ANNOTATIONS.RESOURCE_TYPE] || '';
  const typeKind = annotations[CHOREO_ANNOTATIONS.RESOURCE_TYPE_KIND] || '';
  const namespaceName = annotations[CHOREO_ANNOTATIONS.NAMESPACE] || '';
  const createdAt = annotations[CHOREO_ANNOTATIONS.CREATED_AT];

  const typeLink =
    typeKind && typeName
      ? typeKind === 'ClusterResourceType'
        ? `/catalog/openchoreo-cluster/clusterresourcetype/${typeName}`
        : `/catalog/${namespaceName}/resourcetype/${typeName}`
      : '';

  const parameters = (entity.spec as any)?.parameters as
    | Record<string, unknown>
    | undefined;
  const paramEntries =
    parameters && typeof parameters === 'object'
      ? Object.entries(parameters)
      : [];

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean')
      return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  return (
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">Resource Details</Typography>
      </Box>

      <Box className={classes.statusGrid}>
        <Box className={classes.statusItem}>
          <CategoryIcon className={classes.statusIcon} />
          <Box>
            <Typography className={classes.statusLabel}>Type</Typography>
            {typeLink ? (
              <Chip
                label={<Link to={typeLink}>{typeName}</Link>}
                size="small"
                variant="outlined"
              />
            ) : (
              <Typography className={classes.statusValue}>
                {typeName || 'Unknown'}
              </Typography>
            )}
            {typeKind && (
              <Typography
                className={classes.statusLabel}
                style={{ marginTop: 4 }}
              >
                {typeKind}
              </Typography>
            )}
          </Box>
        </Box>

        {createdAt && (
          <Box className={classes.statusItem}>
            <AccessTimeIcon className={classes.statusIcon} />
            <Box>
              <Typography className={classes.statusLabel}>Created</Typography>
              <Typography className={classes.statusValue}>
                {formatDate(createdAt)}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      <Box mt={2}>
        <Typography className={classes.statusLabel} gutterBottom>
          Parameters ({paramEntries.length})
        </Typography>
        {paramEntries.length === 0 ? (
          <Typography className={classes.statusValue}>
            No parameters set.
          </Typography>
        ) : (
          <Box>
            {paramEntries.map(([key, value]) => (
              <Box key={key} className={classes.infoRow}>
                <Typography className={classes.infoLabel}>{key}</Typography>
                <Typography className={classes.infoValue}>
                  {formatValue(value)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Card>
  );
};
