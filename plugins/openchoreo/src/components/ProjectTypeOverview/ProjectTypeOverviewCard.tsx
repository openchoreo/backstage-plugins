import { useEffect, useMemo, useState } from 'react';
import { Box, Grid, Typography } from '@material-ui/core';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Card, Skeleton } from '@openchoreo/backstage-design-system';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import {
  isClusterScopedKind,
  mapKindToApiKind,
} from '../ResourceDefinition/utils';
import { useDataplaneOverviewStyles } from '../DataplaneOverview/styles';

// Caps each list at ~10 rows (~32px per infoRow) before scroll kicks in.
const LIST_MAX_HEIGHT = 320;

type SchemaProperty = { name: string; type: string };

// Flattens an OpenAPI v3 schema's properties into dot-path rows. Shared shape
// with ResourceTypeOverviewCard.extractSchemaProperties.
function extractSchemaProperties(
  schema: Record<string, unknown> | undefined,
  prefix = '',
): SchemaProperty[] {
  const properties = (schema?.properties ?? {}) as Record<
    string,
    Record<string, unknown> | undefined
  >;
  return Object.entries(properties).flatMap(([key, def]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const type = def?.type as string | undefined;

    if (type === 'object' && def?.properties) {
      const inner = extractSchemaProperties(
        def as Record<string, unknown>,
        path,
      );
      return inner.length === 0 ? [{ name: path, type: 'object' }] : inner;
    }

    if (type === 'array') {
      const items = def?.items as { type?: string } | undefined;
      const itemType = items?.type ?? 'any';
      return [{ name: path, type: `${itemType}[]` }];
    }

    return [{ name: path, type: type ?? 'any' }];
  });
}

type SchemaSection = { openAPIV3Schema?: Record<string, unknown> };
type ValidationRule = { rule?: string; message?: string };
type ResourceTemplateEntry = { id?: string };
type ProjectTypeSpec = {
  parameters?: SchemaSection;
  environmentConfigs?: SchemaSection;
  validations?: ValidationRule[];
  resources?: ResourceTemplateEntry[];
};

export const ProjectTypeOverviewCard = () => {
  const classes = useDataplaneOverviewStyles();
  const { entity } = useEntity();
  const client = useApi(openChoreoClientApiRef);

  const annotations = entity.metadata.annotations || {};
  const createdAt = annotations[CHOREO_ANNOTATIONS.CREATED_AT];
  const namespaceAnnotation = annotations[CHOREO_ANNOTATIONS.NAMESPACE];

  const [spec, setSpec] = useState<ProjectTypeSpec | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const apiKind = mapKindToApiKind(entity.kind);
    const namespace = isClusterScopedKind(entity.kind)
      ? ''
      : namespaceAnnotation ?? entity.metadata.namespace ?? '';

    client
      .getResourceDefinition(apiKind, namespace, entity.metadata.name)
      .then(cr => {
        if (cancelled) return;
        setSpec((cr?.spec as ProjectTypeSpec | undefined) ?? {});
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    client,
    entity.kind,
    entity.metadata.name,
    entity.metadata.namespace,
    namespaceAnnotation,
  ]);

  const parameterProps = useMemo(
    () => extractSchemaProperties(spec?.parameters?.openAPIV3Schema),
    [spec],
  );
  const envConfigProps = useMemo(
    () => extractSchemaProperties(spec?.environmentConfigs?.openAPIV3Schema),
    [spec],
  );
  const validations = spec?.validations ?? [];
  const resources = spec?.resources ?? [];

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

  const renderSchemaSection = (title: string, props: SchemaProperty[]) => (
    <>
      <Typography className={classes.statusLabel} gutterBottom>
        {title} ({props.length})
      </Typography>
      {props.length === 0 ? (
        <Typography variant="body2" color="textSecondary">
          None declared.
        </Typography>
      ) : (
        <Box style={{ maxHeight: LIST_MAX_HEIGHT, overflowY: 'auto' }}>
          {props.map(p => (
            <Box key={p.name} className={classes.infoRow}>
              <Typography className={classes.infoLabel}>{p.name}</Typography>
              <Typography className={classes.infoValue}>{p.type}</Typography>
            </Box>
          ))}
        </Box>
      )}
    </>
  );

  const renderResourcesSection = () => (
    <>
      <Typography className={classes.statusLabel} gutterBottom>
        Resources ({resources.length})
      </Typography>
      {resources.length === 0 ? (
        <Typography variant="body2" color="textSecondary">
          No resource templates declared.
        </Typography>
      ) : (
        <Box style={{ maxHeight: LIST_MAX_HEIGHT, overflowY: 'auto' }}>
          {resources.map((r, i) => (
            <Box key={r.id ?? i} className={classes.infoRow}>
              <Typography className={classes.infoLabel}>
                {r.id ?? `resource-${i}`}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </>
  );

  const renderValidationsSection = () => (
    <>
      <Typography className={classes.statusLabel} gutterBottom>
        Validations ({validations.length})
      </Typography>
      {validations.length === 0 ? (
        <Typography variant="body2" color="textSecondary">
          No validation rules declared.
        </Typography>
      ) : (
        <Box style={{ maxHeight: LIST_MAX_HEIGHT, overflowY: 'auto' }}>
          {validations.map((v, i) => (
            <Box key={i} className={classes.infoRow}>
              <Typography className={classes.infoValue}>
                {v.message || v.rule}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </>
  );

  return (
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">{entity.kind} Details</Typography>
      </Box>

      {createdAt && (
        <Box className={classes.statusGrid}>
          <Box className={classes.statusItem}>
            <AccessTimeIcon className={classes.statusIcon} />
            <Box>
              <Typography className={classes.statusLabel}>Created</Typography>
              <Typography className={classes.statusValue}>
                {formatDate(createdAt)}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      {loading && (
        <Box mt={2}>
          <Skeleton variant="text" width={120} />
          <Skeleton variant="rect" height={32} />
        </Box>
      )}

      {!loading && error && (
        <Box mt={2}>
          <Typography variant="body2" color="error">
            Failed to load project type details: {error.message}
          </Typography>
        </Box>
      )}

      {!loading && !error && (
        <Box mt={2}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              {renderSchemaSection('Parameters', parameterProps)}
            </Grid>
            <Grid item xs={12} sm={6}>
              {renderSchemaSection('Environment Configs', envConfigProps)}
            </Grid>
            <Grid item xs={12} sm={6}>
              {renderResourcesSection()}
            </Grid>
            <Grid item xs={12} sm={6}>
              {renderValidationsSection()}
            </Grid>
          </Grid>
        </Box>
      )}
    </Card>
  );
};
