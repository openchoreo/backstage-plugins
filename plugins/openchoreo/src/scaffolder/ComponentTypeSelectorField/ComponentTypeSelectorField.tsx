import { useEffect, useState } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import type { FieldValidation } from '@rjsf/utils';
import {
  Box,
  TextField,
  MenuItem,
  CircularProgress,
  FormHelperText,
  Typography,
} from '@material-ui/core';
import { JSONSchema7 } from 'json-schema';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { ComponentTypeParamsForm } from './ComponentTypeParamsForm';

export interface AllowedWorkflowRef {
  kind?: string;
  name: string;
}

export interface ComponentTypeSelection {
  componentType: string;
  componentTypeKind: 'ComponentType' | 'ClusterComponentType';
  workloadType: string;
  namespaceName: string;
  allowedWorkflows: AllowedWorkflowRef[];
  parameters: Record<string, unknown>;
}

interface ComponentTypeOption {
  key: string;
  name: string;
  title: string;
  kind: 'ComponentType' | 'ClusterComponentType';
  workloadType: string;
  namespace: string;
  allowedWorkflows: AllowedWorkflowRef[];
}

/**
 * Pull allowedWorkflows out of a generated template entity — the converter
 * stores them on the build workflow picker's ui:options in {kind,name} shape.
 */
function extractAllowedWorkflows(entity: any): AllowedWorkflowRef[] {
  const sections = entity?.spec?.parameters;
  if (!Array.isArray(sections)) return [];
  for (const section of sections) {
    const aw =
      section?.properties?.buildAndDeploy?.properties?.workflow_name?.[
        'ui:options'
      ]?.allowedWorkflows;
    if (Array.isArray(aw)) return aw;
  }
  return [];
}

export const ComponentTypeSelectorFieldSchema = {
  returnValue: {
    type: 'object' as const,
    additionalProperties: true,
  },
};

/**
 * Selects a ComponentType (from the catalog's generated templates) and renders
 * that type's parameter form dynamically.
 */
export const ComponentTypeSelectorField = ({
  onChange,
  formData,
  formContext,
  rawErrors,
}: FieldExtensionComponentProps<ComponentTypeSelection>) => {
  const catalogApi = useApi(catalogApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  // May arrive as an entity ref (e.g. `domain:default/engineering`); the catalog
  // metadata namespace is the last segment.
  const rawNamespaceName: string =
    (formContext?.formData as any)?.project_namespace?.namespace_name ||
    (formContext?.formData as any)?.namespace_name ||
    '';
  const namespaceName = rawNamespaceName.split('/').pop() ?? '';

  const [options, setOptions] = useState<ComponentTypeOption[]>([]);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [schema, setSchema] = useState<JSONSchema7 | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const selectedKey = formData?.componentType
    ? `${formData.componentTypeKind}:${formData.componentType}`
    : '';

  // Load available component types from the generated Template entities.
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await catalogApi.getEntities({
          filter: {
            kind: 'Template',
            [`metadata.annotations.${CHOREO_ANNOTATIONS.CTD_GENERATED}`]:
              'true',
          },
        });
        if (ignore) return;
        const items: ComponentTypeOption[] = res.items
          .map(e => {
            const ann = e.metadata.annotations ?? {};
            const kind =
              ann[CHOREO_ANNOTATIONS.CTD_KIND] === 'ClusterComponentType'
                ? ('ClusterComponentType' as const)
                : ('ComponentType' as const);
            return {
              key: `${kind}:${ann[CHOREO_ANNOTATIONS.CTD_NAME]}`,
              name: ann[CHOREO_ANNOTATIONS.CTD_NAME] ?? '',
              title:
                (e.metadata.title as string) ??
                ann[CHOREO_ANNOTATIONS.CTD_NAME] ??
                '',
              kind,
              workloadType: ann[CHOREO_ANNOTATIONS.WORKLOAD_TYPE] ?? '',
              namespace: e.metadata.namespace ?? 'default',
              allowedWorkflows: extractAllowedWorkflows(e),
            };
          })
          .filter(o => o.name)
          // Cluster types are always available; namespace types must match.
          .filter(
            o =>
              o.kind === 'ClusterComponentType' ||
              !namespaceName ||
              o.namespace === namespaceName,
          );
        setOptions(items);
      } catch (err) {
        if (!ignore) setOptionsError(`Failed to load component types: ${err}`);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [catalogApi, namespaceName]);

  // Fetch the schema for the selected component type.
  useEffect(() => {
    let ignore = false;
    if (!formData?.componentType) {
      setSchema(null);
      return undefined;
    }
    (async () => {
      setSchemaLoading(true);
      setSchemaError(null);
      try {
        const baseUrl = await discoveryApi.getBaseUrl('openchoreo');
        const url =
          formData.componentTypeKind === 'ClusterComponentType'
            ? `${baseUrl}/cluster-component-type-schema?cctName=${encodeURIComponent(
                formData.componentType,
              )}`
            : `${baseUrl}/component-type-schema?namespaceName=${encodeURIComponent(
                formData.namespaceName,
              )}&ctName=${encodeURIComponent(formData.componentType)}`;
        const response = await fetchApi.fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        if (!ignore) setSchema((result?.data ?? {}) as JSONSchema7);
      } catch (err) {
        if (!ignore) setSchemaError(`Failed to load parameters: ${err}`);
      } finally {
        if (!ignore) setSchemaLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [
    discoveryApi,
    fetchApi,
    formData?.componentType,
    formData?.componentTypeKind,
    formData?.namespaceName,
  ]);

  const handleSelect = (key: string) => {
    const opt = options.find(o => o.key === key);
    if (!opt) return;
    onChange({
      componentType: opt.name,
      componentTypeKind: opt.kind,
      workloadType: opt.workloadType,
      namespaceName: opt.namespace,
      allowedWorkflows: opt.allowedWorkflows,
      parameters: {},
    });
  };

  const handleParamsChange = (parameters: Record<string, unknown>) => {
    if (!formData) return;
    onChange({ ...formData, parameters });
  };

  const hasError = !!rawErrors?.length && !formData?.componentType;

  return (
    <Box>
      <TextField
        select
        label="Component Type"
        value={selectedKey}
        onChange={e => handleSelect(e.target.value)}
        fullWidth
        variant="outlined"
        required
        error={hasError || !!optionsError}
        helperText={
          optionsError ??
          (options.length === 0
            ? 'No component types available for this project'
            : 'Select the type of component to create')
        }
      >
        {options.map(o => (
          <MenuItem key={o.key} value={o.key}>
            {o.title}
          </MenuItem>
        ))}
      </TextField>

      {schemaLoading && (
        <Box mt={2} display="flex" alignItems="center" style={{ gap: 8 }}>
          <CircularProgress size={20} />
          <Typography variant="body2">Loading parameters…</Typography>
        </Box>
      )}
      {schemaError && <FormHelperText error>{schemaError}</FormHelperText>}
      {!schemaLoading && schema && formData?.componentType && (
        <Box mt={2}>
          <ComponentTypeParamsForm
            resetKey={selectedKey}
            schema={schema}
            formData={formData.parameters ?? {}}
            onChange={handleParamsChange}
          />
        </Box>
      )}
    </Box>
  );
};

export const componentTypeSelectorFieldValidation = (
  value: ComponentTypeSelection,
  validation: FieldValidation,
) => {
  if (!value?.componentType) {
    validation.addError('Component type is required');
  }
};
