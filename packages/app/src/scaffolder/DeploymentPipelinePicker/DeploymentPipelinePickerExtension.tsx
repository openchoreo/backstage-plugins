import { useEffect, useState } from 'react';
import {
  TextField,
  MenuItem,
  CircularProgress,
  InputAdornment,
} from '@material-ui/core';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

function extractNamespaceName(entityRef: string): string {
  if (!entityRef) return '';
  const parts = entityRef.split('/');
  return parts[parts.length - 1];
}

export const DeploymentPipelinePicker = ({
  onChange,
  formData,
  formContext,
  schema,
  rawErrors,
}: FieldExtensionComponentProps<string>) => {
  const catalogApi = useApi(catalogApiRef);
  const [pipelines, setPipelines] = useState<
    Array<{ name: string; displayName: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string>();

  const namespaceRef = formContext?.formData?.namespace_name as
    | string
    | undefined;
  const namespaceName = extractNamespaceName(namespaceRef || '');

  useEffect(() => {
    let ignore = false;

    if (!namespaceName) {
      setPipelines([]);
      setLoading(false);
      return undefined;
    }

    setPipelines([]);
    setLoading(true);
    setFetchError(undefined);

    const fetchPipelines = async () => {
      try {
        const { items } = await catalogApi.getEntities({
          filter: { kind: 'DeploymentPipeline' },
        });
        const filtered = items.filter(
          e =>
            e.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ===
              namespaceName &&
            !e.metadata.annotations?.[CHOREO_ANNOTATIONS.DELETION_TIMESTAMP],
        );
        if (!ignore) {
          setPipelines(
            filtered.map(e => ({
              name: e.metadata.name,
              displayName: (e.metadata.title || e.metadata.name) as string,
            })),
          );
        }
      } catch (err) {
        if (!ignore) {
          setPipelines([]);
          setFetchError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchPipelines();
    return () => {
      ignore = true;
    };
  }, [namespaceName, catalogApi]);

  // Auto-select or reset selection when namespace/pipelines change
  useEffect(() => {
    if (!namespaceName) {
      if (formData) onChange('');
      return;
    }
    if (pipelines.length === 0) {
      if (formData) onChange('');
      return;
    }

    const currentValid = formData && pipelines.some(p => p.name === formData);
    if (!currentValid) {
      // Prefer 'default' pipeline if available, otherwise the first
      const defaultPipeline = pipelines.find(p => p.name === 'default');
      onChange((defaultPipeline ?? pipelines[0]).name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelines, namespaceName]);

  const hasError = (rawErrors?.length ?? 0) > 0;
  const noPipelines = !loading && !!namespaceName && pipelines.length === 0;

  const placeholder = !namespaceName
    ? 'Select a namespace first'
    : noPipelines
      ? 'No deployment pipelines in the selected namespace'
      : '';

  return (
    <TextField
      select
      label={schema?.title ?? 'Deployment Pipeline'}
      value={formData ?? ''}
      onChange={e => onChange(e.target.value)}
      disabled={loading || !namespaceName}
      fullWidth
      variant="outlined"
      error={hasError || !!fetchError}
      helperText={
        hasError
          ? rawErrors?.[0]
          : fetchError || undefined
      }
      InputProps={{
        endAdornment: loading ? (
          <InputAdornment position="end">
            <CircularProgress size={20} />
          </InputAdornment>
        ) : undefined,
      }}
    >
      {noPipelines && (
        <MenuItem disabled value="">
          No deployment pipelines in the selected namespace
        </MenuItem>
      )}
      {pipelines.map(p => (
        <MenuItem key={p.name} value={p.name}>
          {p.displayName}
        </MenuItem>
      ))}
    </TextField>
  );
};
