import { Box, Typography } from '@material-ui/core';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Card } from '@openchoreo/backstage-design-system';
import { useDataplaneOverviewStyles } from '../DataplaneOverview/styles';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null && typeof value === 'object' && !Array.isArray(value)
  );
}

/**
 * Flatten nested parameter objects so `{ database: { size: 'small' } }`
 * surfaces as a single `database.size` row. Arrays stay JSON-stringified
 * since they're rarely used in parameter shapes and indexing them would
 * blow up row counts.
 */
function flattenParameters(
  obj: Record<string, unknown>,
  prefix = '',
): [string, unknown][] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) {
      const inner = flattenParameters(value, path);
      // Represent empty nested object as a row to avoid silently dropping
      // it from the count.
      return inner.length === 0 ? [[path, value]] : inner;
    }
    return [[path, value]];
  });
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export const ResourceParametersCard = () => {
  const classes = useDataplaneOverviewStyles();
  const { entity } = useEntity();

  const parameters = (entity.spec as any)?.parameters as
    | Record<string, unknown>
    | undefined;
  const paramEntries = isPlainObject(parameters)
    ? flattenParameters(parameters)
    : [];

  return (
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">Parameters ({paramEntries.length})</Typography>
      </Box>

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
    </Card>
  );
};
