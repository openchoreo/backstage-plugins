import { useEffect, useRef, useState } from 'react';
import {
  TextField,
  MenuItem,
  CircularProgress,
  InputAdornment,
} from '@material-ui/core';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

export interface NamespaceOption {
  name: string;
  entityRef: string;
  displayName?: string;
}

export interface NamespaceSelectFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  helperText?: string;
  required?: boolean;
  error?: boolean;
  /** Called once after namespaces have been fetched. Useful for callers that
   * need the raw namespace list (e.g. for YAML ↔ form round-tripping). */
  onNamespacesLoaded?: (namespaces: NamespaceOption[]) => void;
}

/**
 * Shared namespace dropdown. Fetches all active Domain entities and renders
 * them as a select. Does NOT auto-select any value — the initial selection
 * is the caller's responsibility.
 */
export const NamespaceSelectField = ({
  value,
  onChange,
  label = 'Namespace',
  helperText = 'Select the namespace for this resource',
  required,
  error,
  onNamespacesLoaded,
}: NamespaceSelectFieldProps) => {
  const catalogApi = useApi(catalogApiRef);
  const [namespaces, setNamespaces] = useState<NamespaceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string>();
  const onNamespacesLoadedRef = useRef(onNamespacesLoaded);
  useEffect(() => {
    onNamespacesLoadedRef.current = onNamespacesLoaded;
  });

  useEffect(() => {
    let ignore = false;

    const fetch = async () => {
      try {
        const { items } = await catalogApi.getEntities({
          filter: { kind: 'Domain' },
        });
        const active = items.filter(
          e => !e.metadata.annotations?.[CHOREO_ANNOTATIONS.DELETION_TIMESTAMP],
        );
        const list: NamespaceOption[] = active.map(e => ({
          name: e.metadata.name,
          entityRef: `domain:${e.metadata.namespace || 'default'}/${
            e.metadata.name
          }`,
          displayName: e.metadata.title || e.metadata.name,
        }));
        if (ignore) return;
        setNamespaces(list);
        onNamespacesLoadedRef.current?.(list);
      } catch (err) {
        if (!ignore) {
          const message = err instanceof Error ? err.message : String(err);
          // eslint-disable-next-line no-console
          console.error('Failed to fetch namespaces', err);
          setFetchError(message);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetch();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TextField
      select
      label={label}
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={loading}
      fullWidth
      variant="outlined"
      required={required}
      error={error || !!fetchError}
      helperText={fetchError || helperText}
      InputProps={{
        endAdornment: loading ? (
          <InputAdornment position="end">
            <CircularProgress size={20} />
          </InputAdornment>
        ) : undefined,
      }}
    >
      {namespaces.map(ns => (
        <MenuItem key={ns.entityRef} value={ns.entityRef}>
          {ns.displayName ?? ns.name}
        </MenuItem>
      ))}
    </TextField>
  );
};
