import { useEffect, useMemo, useState } from 'react';
import { Box, Chip, Grid, Typography } from '@material-ui/core';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import LockOpenIcon from '@material-ui/icons/LockOpen';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { Card, Skeleton } from '@openchoreo/backstage-design-system';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import {
  openChoreoClientApiRef,
  type ResourceTypeOutput,
} from '../../api/OpenChoreoClientApi';
import { useDataplaneOverviewStyles } from '../DataplaneOverview/styles';

// Caps each list at ~10 rows (~32px per infoRow) before scroll kicks in.
const LIST_MAX_HEIGHT = 320;

function outputKindLabel(o: ResourceTypeOutput): string {
  if (o.secretKeyRef) return 'Secret';
  if (o.configMapKeyRef) return 'ConfigMap';
  return 'Value';
}

type SchemaProperty = { name: string; type: string };

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

    // Nested object: recurse and emit dot-path rows. Empty objects (no
    // declared properties) keep a single 'object' row so the count stays
    // honest.
    if (type === 'object' && def?.properties) {
      const inner = extractSchemaProperties(
        def as Record<string, unknown>,
        path,
      );
      return inner.length === 0 ? [{ name: path, type: 'object' }] : inner;
    }

    // Array with declared item type: render as `<element>[]`.
    if (type === 'array') {
      const items = def?.items as { type?: string } | undefined;
      const itemType = items?.type ?? 'any';
      return [{ name: path, type: `${itemType}[]` }];
    }

    return [{ name: path, type: type ?? 'any' }];
  });
}

export const ResourceTypeOverviewCard = () => {
  const classes = useDataplaneOverviewStyles();
  const { entity } = useEntity();
  const client = useApi(openChoreoClientApiRef);

  const spec = entity.spec as any;
  const annotations = entity.metadata.annotations || {};

  const retainPolicy = spec?.retainPolicy as string | undefined;
  const createdAt = annotations[CHOREO_ANNOTATIONS.CREATED_AT];

  // The shared client methods take a Resource entity and dispatch on its
  // RESOURCE_TYPE / RESOURCE_TYPE_KIND annotations. On the type's own page
  // there's no Resource entity, so synthesize the equivalent ref-shape from
  // the type entity itself.
  const refEntity = useMemo<Entity>(
    () =>
      ({
        apiVersion: entity.apiVersion,
        kind: 'Resource',
        metadata: {
          name: entity.metadata.name,
          namespace: entity.metadata.namespace,
          annotations: {
            [CHOREO_ANNOTATIONS.NAMESPACE]: entity.metadata.namespace ?? '',
            [CHOREO_ANNOTATIONS.RESOURCE_TYPE]: entity.metadata.name,
            [CHOREO_ANNOTATIONS.RESOURCE_TYPE_KIND]: entity.kind,
          },
        },
        spec: {},
      } as Entity),
    [entity],
  );

  const [outputs, setOutputs] = useState<ResourceTypeOutput[]>([]);
  const [outputsLoading, setOutputsLoading] = useState(true);
  const [outputsError, setOutputsError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setOutputsLoading(true);
    setOutputsError(null);
    client
      .fetchResourceTypeOutputs(refEntity)
      .then(res => {
        if (cancelled) return;
        setOutputs(res?.data ?? []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setOutputsError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (cancelled) return;
        setOutputsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, refEntity]);

  const [schema, setSchema] = useState<Record<string, unknown> | undefined>();
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [schemaError, setSchemaError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSchemaLoading(true);
    setSchemaError(null);
    client
      .fetchResourceTypeSchema(refEntity)
      .then(res => {
        if (cancelled) return;
        setSchema(res?.data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSchemaError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (cancelled) return;
        setSchemaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, refEntity]);

  const schemaProperties = useMemo(
    () => extractSchemaProperties(schema),
    [schema],
  );

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

  const renderOutputsSection = () => {
    if (outputsLoading) {
      return (
        <>
          <Skeleton variant="text" width={120} />
          <Skeleton variant="rect" height={32} />
        </>
      );
    }
    if (outputsError) {
      return (
        <>
          <Typography className={classes.statusLabel} gutterBottom>
            Outputs
          </Typography>
          <Typography variant="body2" color="error">
            Failed to load outputs: {outputsError.message}
          </Typography>
        </>
      );
    }
    return (
      <>
        <Typography className={classes.statusLabel} gutterBottom>
          Outputs ({outputs.length})
        </Typography>
        {outputs.length === 0 ? (
          <Typography variant="body2" color="textSecondary">
            No outputs declared.
          </Typography>
        ) : (
          <Box style={{ maxHeight: LIST_MAX_HEIGHT, overflowY: 'auto' }}>
            {outputs.map(o => (
              <Box key={o.name} className={classes.infoRow}>
                <Typography className={classes.infoLabel}>{o.name}</Typography>
                <Typography className={classes.infoValue}>
                  {outputKindLabel(o)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </>
    );
  };

  const renderParametersSection = () => {
    if (schemaLoading) {
      return (
        <>
          <Skeleton variant="text" width={120} />
          <Skeleton variant="rect" height={32} />
        </>
      );
    }
    if (schemaError) {
      return (
        <>
          <Typography className={classes.statusLabel} gutterBottom>
            Parameters
          </Typography>
          <Typography variant="body2" color="error">
            Failed to load parameters: {schemaError.message}
          </Typography>
        </>
      );
    }
    return (
      <>
        <Typography className={classes.statusLabel} gutterBottom>
          Parameters ({schemaProperties.length})
        </Typography>
        {schemaProperties.length === 0 ? (
          <Typography variant="body2" color="textSecondary">
            No parameters declared.
          </Typography>
        ) : (
          <Box style={{ maxHeight: LIST_MAX_HEIGHT, overflowY: 'auto' }}>
            {schemaProperties.map(p => (
              <Box key={p.name} className={classes.infoRow}>
                <Typography className={classes.infoLabel}>{p.name}</Typography>
                <Typography className={classes.infoValue}>{p.type}</Typography>
              </Box>
            ))}
          </Box>
        )}
      </>
    );
  };

  return (
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">{entity.kind} Details</Typography>
      </Box>

      <Box className={classes.statusGrid}>
        {retainPolicy && (
          <Box className={classes.statusItem}>
            <LockOpenIcon className={classes.statusIcon} />
            <Box>
              <Typography className={classes.statusLabel}>
                Retain Policy
              </Typography>
              <Chip label={retainPolicy} size="small" />
            </Box>
          </Box>
        )}

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
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            {renderParametersSection()}
          </Grid>
          <Grid item xs={12} sm={6}>
            {renderOutputsSection()}
          </Grid>
        </Grid>
      </Box>
    </Card>
  );
};
