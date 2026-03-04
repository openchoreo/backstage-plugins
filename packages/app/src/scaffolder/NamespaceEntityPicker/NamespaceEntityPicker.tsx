import { useEffect, useRef, useState } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import {
  TextField,
  MenuItem,
  CircularProgress,
  InputAdornment,
} from '@material-ui/core';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useScaffolderPreselection } from '../ScaffolderPreselectionContext';

/**
 * A custom field extension for selecting a namespace (Domain entity).
 * Stores the selected value as an entity reference (e.g. "domain:default/engineering").
 *
 * On mount, pre-selects the namespace captured from the URL `namespace` query
 * parameter via ScaffolderPreselectionContext, falling back to the first
 * available namespace when no preselection is present.
 */
export const NamespaceEntityPicker = ({
  onChange,
  formData,
  schema,
  rawErrors,
  required,
}: FieldExtensionComponentProps<string>) => {
  const catalogApi = useApi(catalogApiRef);
  const { preselectedNamespace, clearPreselectedNamespace } =
    useScaffolderPreselection();

  const [namespaces, setNamespaces] = useState<
    Array<{ name: string; entityRef: string; displayName?: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const preselectionAppliedRef = useRef(false);

  useEffect(() => {
    let ignore = false;

    const fetchNamespaces = async () => {
      setLoading(true);
      try {
        const { items } = await catalogApi.getEntities({
          filter: { kind: 'Domain' },
        });

        const activeItems = items.filter(
          entity =>
            !entity.metadata.annotations?.[
              CHOREO_ANNOTATIONS.DELETION_TIMESTAMP
            ],
        );

        const list = activeItems.map(entity => ({
          name: entity.metadata.name,
          entityRef: `domain:${entity.metadata.namespace || 'default'}/${entity.metadata.name}`,
          displayName: entity.metadata.title || entity.metadata.name,
        }));

        if (ignore) return;
        setNamespaces(list);

        if (list.length === 0) return;

        // Determine the value to apply
        let valueToSet: string | undefined;

        if (!formData) {
          // Apply preselection if available and not yet applied
          if (preselectedNamespace && !preselectionAppliedRef.current) {
            const match = list.find(ns => ns.name === preselectedNamespace);
            if (match) {
              valueToSet = match.entityRef;
              preselectionAppliedRef.current = true;
              clearPreselectedNamespace();
            }
          }

          // Fall back to first namespace
          if (!valueToSet) {
            valueToSet = list[0].entityRef;
          }

          onChange(valueToSet);
        }
      } catch (err) {
        if (!ignore) {
          setError(`Failed to fetch namespaces: ${err}`);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchNamespaces();
    return () => {
      ignore = true;
    };
    // Run only on mount — preselectedNamespace is captured once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasError = (rawErrors?.length ?? 0) > 0;

  return (
    <TextField
      select
      label={schema?.title ?? 'Namespace'}
      value={formData ?? ''}
      onChange={e => onChange(e.target.value)}
      disabled={loading}
      fullWidth
      variant="outlined"
      required={required}
      error={hasError || !!error}
      helperText={
        error ??
        (hasError ? rawErrors?.[0] : 'Select the namespace for this resource')
      }
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
