import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Typography,
  makeStyles,
} from '@material-ui/core';
import { Alert, Skeleton } from '@material-ui/lab';
import type { JSONSchema7 } from 'json-schema';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import {
  DetailPageLayout,
  ForbiddenState,
} from '@openchoreo/backstage-plugin-react';
import { RjsfForm } from '@openchoreo/backstage-design-system';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import { isForbiddenError, getErrorMessage } from '../../utils/errorUtils';
import { useNotification } from '../../hooks';
import { NotificationBanner } from '../Environments/components';

const useStyles = makeStyles(theme => ({
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(4),
  },
  formCard: {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 12,
    padding: theme.spacing(3),
  },
  formHint: {
    color: theme.palette.text.secondary,
    fontSize: theme.typography.body2.fontSize,
    marginBottom: theme.spacing(2),
  },
  emptyState: {
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
    padding: theme.spacing(4),
    textAlign: 'center',
  },
}));

export interface ResourceParametersConfigPageProps {
  onBack: () => void;
  onSaved: () => void;
}

/**
 * Edits `Resource.spec.parameters` against the per-type RJSF schema
 * fetched from the (Cluster)ResourceType the Resource consumes.
 * Mutating parameters causes the Resource controller to auto-cut a new
 * `ResourceRelease`, so there's no explicit "create release" step here.
 */
export const ResourceParametersConfigPage = ({
  onBack,
  onSaved,
}: ResourceParametersConfigPageProps) => {
  const classes = useStyles();
  const { entity } = useEntity();
  const client = useApi(openChoreoClientApiRef);
  const notification = useNotification();

  const [resource, setResource] = useState<Record<string, unknown> | null>(
    null,
  );
  const [schema, setSchema] = useState<JSONSchema7 | null>(null);
  const [parameters, setParameters] = useState<Record<string, unknown>>({});
  const [initialParameters, setInitialParameters] = useState<
    Record<string, unknown>
  >({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const namespaceName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] || '';
  const resourceName = entity.metadata.name;
  const rtName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.RESOURCE_TYPE] || '';
  const rtDisplayName =
    (entity.metadata.annotations?.[CHOREO_ANNOTATIONS.RTD_DISPLAY_NAME] ||
      rtName) ?? rtName;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    const load = async () => {
      try {
        const [resourceData, schemaResult] = await Promise.all([
          client.getResourceDefinition('resources', namespaceName, resourceName),
          client.fetchResourceTypeSchema(entity),
        ]);

        if (cancelled) return;

        setResource(resourceData);
        const spec = (resourceData?.spec as Record<string, unknown>) || {};
        const currentParams = (spec.parameters as Record<string, unknown>) || {};
        setParameters(currentParams);
        setInitialParameters(JSON.parse(JSON.stringify(currentParams)));

        if (schemaResult.success && schemaResult.data) {
          setSchema(schemaResult.data as JSONSchema7);
        } else {
          setSchema({} as JSONSchema7);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [client, entity, namespaceName, resourceName]);

  const hasChanges = useMemo(
    () => JSON.stringify(parameters) !== JSON.stringify(initialParameters),
    [parameters, initialParameters],
  );

  const hasFields =
    !!schema?.properties && Object.keys(schema.properties).length > 0;

  const handleSave = useCallback(async () => {
    if (!resource) return;
    setSaving(true);
    setSaveError(null);
    try {
      const next: Record<string, unknown> = {
        ...resource,
        spec: {
          ...((resource.spec as Record<string, unknown>) || {}),
          parameters,
        },
      };
      await client.updateResourceDefinition(
        'resources',
        namespaceName,
        resourceName,
        next,
      );
      notification.showSuccess(
        `Saved configuration for ${resourceName}. A new release will be cut shortly.`,
      );
      onSaved();
    } catch (err: unknown) {
      setSaveError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }, [
    client,
    namespaceName,
    notification,
    onSaved,
    parameters,
    resource,
    resourceName,
  ]);

  const headerActions = !loading && !loadError && (
    <Button
      variant="contained"
      color="primary"
      onClick={handleSave}
      disabled={saving || !hasChanges || !resource}
      startIcon={
        saving ? <CircularProgress size={20} color="inherit" /> : undefined
      }
    >
      {saving ? 'Saving' : 'Save & Close'}
    </Button>
  );

  if (isForbiddenError(loadError)) {
    return (
      <ForbiddenState
        message="You do not have permission to configure this resource."
        minHeight="400px"
      />
    );
  }

  return (
    <DetailPageLayout
      title="Configure Resource"
      subtitle={`Edit the parameters bound to the ${rtDisplayName} schema. Saving cuts a new release.`}
      onBack={onBack}
      actions={headerActions}
    >
      <NotificationBanner notification={notification.notification} />

      {loading && (
        <Box className={classes.loadingContainer}>
          <Skeleton variant="rect" width="100%" height={64} />
          <Skeleton variant="rect" width="100%" height={120} />
          <Skeleton variant="rect" width="100%" height={120} />
        </Box>
      )}

      {loadError && !loading && (
        <Box mb={2}>
          <Alert severity="error">
            Failed to load resource configuration: {getErrorMessage(loadError)}
          </Alert>
        </Box>
      )}

      {saveError && !loading && (
        <Box mb={2}>
          <Alert severity="error" onClose={() => setSaveError(null)}>
            {saveError}
          </Alert>
        </Box>
      )}

      {!loading && !loadError && (
        <Box className={classes.formCard}>
          {hasFields ? (
            <>
              <Typography className={classes.formHint}>
                Fill in the parameters defined by {rtDisplayName}.
              </Typography>
              <RjsfForm
                schema={schema as any}
                uiSchema={{}}
                formData={parameters}
                onChange={data => setParameters(data.formData ?? {})}
                tagName="div"
              />
            </>
          ) : (
            <Typography className={classes.emptyState}>
              {rtDisplayName} has no configurable parameters.
            </Typography>
          )}
        </Box>
      )}
    </DetailPageLayout>
  );
};
