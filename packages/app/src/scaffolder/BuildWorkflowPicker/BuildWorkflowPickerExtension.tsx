import { ChangeEvent, useState, useEffect, useMemo } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import type { FieldValidation } from '@rjsf/utils';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  CircularProgress,
} from '@material-ui/core';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import type { WorkflowKind, WorkflowSelection } from '../types';

export type { WorkflowSelection };

/*
 Schema for the Build Workflow Picker field
*/
export const BuildWorkflowPickerSchema = {
  returnValue: {
    type: 'object' as const,
    properties: {
      kind: { type: 'string' as const },
      name: { type: 'string' as const },
    },
    required: ['kind', 'name'],
  },
};

interface AllowedWorkflowRef {
  kind?: WorkflowKind;
  name: string;
}

interface WorkflowOption extends WorkflowSelection {
  displayName?: string;
}

function workflowKey(workflow: WorkflowSelection): string {
  return `${workflow.kind}:${workflow.name}`;
}

function normalizeWorkflowItem(item: any, kind: WorkflowKind): WorkflowOption {
  const displayName = (item.displayName ??
    item.metadata?.annotations?.['openchoreo.dev/display-name'] ??
    item.name ??
    item.metadata?.name) as string | undefined;
  return {
    kind,
    name: (item.name ?? item.metadata?.name) as string,
    displayName: `${displayName} ${
      kind === 'ClusterWorkflow' ? '(cluster)' : ''
    }`,
  };
}

function getWorkflowDisplayName(workflow: WorkflowOption): string {
  if (workflow.displayName) return workflow.displayName;
  return workflow.kind === 'ClusterWorkflow'
    ? `${workflow.name} (cluster)`
    : workflow.name;
}

/*
 This is the actual component that will get rendered in the form

 Note: The workflows can be defined via enum in the schema (from allowedWorkflows in CTD).
 If enum is not provided, this component fetches all workflows from the API.
 The BuildWorkflowParameters component (which is a sibling field) reads the selected
 workflow from formData to fetch its schema.
*/
export const BuildWorkflowPicker = ({
  onChange,
  rawErrors,
  required,
  formData,
  idSchema,
  uiSchema,
  schema,
}: FieldExtensionComponentProps<WorkflowSelection>) => {
  const [workflowOptions, setWorkflowOptions] = useState<WorkflowOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  // Get namespaceName and ctdKind from ui:options
  const namespaceName =
    typeof uiSchema?.['ui:options']?.namespaceName === 'string'
      ? uiSchema['ui:options'].namespaceName
      : '';
  const ctdKind =
    typeof uiSchema?.['ui:options']?.ctdKind === 'string'
      ? (uiSchema['ui:options'].ctdKind as string)
      : 'ComponentType';
  const isClusterComponentType = ctdKind === 'ClusterComponentType';
  const defaultWorkflowKind: WorkflowKind = isClusterComponentType
    ? 'ClusterWorkflow'
    : 'Workflow';

  const allowedWorkflows =
    (uiSchema?.['ui:options']?.allowedWorkflows as
      | AllowedWorkflowRef[]
      | undefined) ?? undefined;

  const [selectedKey, setSelectedKey] = useState<string>('');

  // Keep selectedKey in sync with formData
  useEffect(() => {
    if (formData && formData.name) {
      const kind = formData.kind ?? defaultWorkflowKind;
      setSelectedKey(workflowKey({ kind, name: formData.name }));
    } else {
      setSelectedKey('');
    }
  }, [formData, defaultWorkflowKind]);

  // Fetch workflows from API
  useEffect(() => {
    let ignore = false;

    const fetchWorkflows = async () => {
      if (!isClusterComponentType && !namespaceName) {
        setError('Namespace name is required to fetch workflows');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const baseUrl = await discoveryApi.getBaseUrl('openchoreo-ci-backend');

        // Extract namespace name if it's in entity reference format
        const extractNsName = (fullNsName: string): string => {
          const parts = fullNsName.split('/');
          return parts[parts.length - 1];
        };

        const allWorkflows: WorkflowOption[] = [];

        if (isClusterComponentType) {
          // ClusterComponentType: only fetch cluster workflows
          const response = await fetchApi.fetch(`${baseUrl}/cluster-workflows`);
          if (response.ok) {
            const result = await response.json();
            const items = result.data?.items ?? result.items ?? [];
            if (Array.isArray(items)) {
              allWorkflows.push(
                ...items.map((item: any) =>
                  normalizeWorkflowItem(item, 'ClusterWorkflow'),
                ),
              );
            }
          }
        } else {
          // ComponentType: fetch both namespace workflows and cluster workflows
          const nsName = extractNsName(namespaceName);

          const [nsResponse, clusterResponse] = await Promise.all([
            fetchApi.fetch(
              `${baseUrl}/workflows?namespaceName=${encodeURIComponent(
                nsName,
              )}`,
            ),
            fetchApi.fetch(`${baseUrl}/cluster-workflows`),
          ]);

          if (nsResponse.ok) {
            const nsResult = await nsResponse.json();
            // openchoreo-ci-backend /workflows returns { items } (no success/data wrapper)
            const nsItems = nsResult.items ?? nsResult.data?.items ?? [];
            if (Array.isArray(nsItems)) {
              allWorkflows.push(
                ...nsItems.map((item: any) =>
                  normalizeWorkflowItem(item, 'Workflow'),
                ),
              );
            }
          }

          if (clusterResponse.ok) {
            const clusterResult = await clusterResponse.json();
            // openchoreo-ci-backend /cluster-workflows returns { success, data: { items } }
            const clusterItems =
              clusterResult.data?.items ?? clusterResult.items ?? [];
            if (Array.isArray(clusterItems)) {
              allWorkflows.push(
                ...clusterItems.map((item: any) =>
                  normalizeWorkflowItem(item, 'ClusterWorkflow'),
                ),
              );
            }
          }
        }

        if (!ignore) {
          setWorkflowOptions(allWorkflows);
        }
      } catch (err) {
        if (!ignore) {
          setError(`Failed to fetch workflows: ${err}`);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchWorkflows();

    return () => {
      ignore = true;
    };
    // Only re-fetch when namespace or CTD type changes; not when formData or ui:options reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespaceName, isClusterComponentType]);

  // Separate filtering from fetching so that allowedWorkflows changes are
  // reflected without triggering a full re-fetch.
  const filteredOptions = useMemo(() => {
    if (!allowedWorkflows || allowedWorkflows.length === 0) {
      return workflowOptions;
    }
    const normalizedAllowed = allowedWorkflows.map(w => ({
      kind: (w.kind as WorkflowKind | undefined) ?? defaultWorkflowKind,
      name: w.name,
    }));
    return workflowOptions.filter(opt =>
      normalizedAllowed.some(
        aw => aw.name === opt.name && aw.kind === opt.kind,
      ),
    );
  }, [workflowOptions, allowedWorkflows, defaultWorkflowKind]);

  const handleDropdownChange = (event: ChangeEvent<{ value: unknown }>) => {
    const key = event.target.value as string;
    setSelectedKey(key);
    const selected = filteredOptions.find(w => workflowKey(w) === key);
    if (selected) {
      onChange({ kind: selected.kind, name: selected.name });
    }
  };

  const label = uiSchema?.['ui:title'] || schema.title || 'Build Workflow';

  // Standard dropdown for non-buildpack workflows
  return (
    <FormControl
      fullWidth
      margin="normal"
      variant="outlined"
      error={!!rawErrors?.length || !!error}
      required={required}
    >
      <InputLabel id={`${idSchema?.$id}-label`}>{label}</InputLabel>
      <Select
        labelId={`${idSchema?.$id}-label`}
        label={label}
        value={selectedKey || ''}
        onChange={handleDropdownChange}
        disabled={loading || filteredOptions.length === 0}
      >
        {loading && (
          <MenuItem disabled>
            <CircularProgress size={20} style={{ marginRight: 8 }} />
            Loading workflows...
          </MenuItem>
        )}
        {!loading && filteredOptions.length === 0 && (
          <MenuItem disabled>No workflows available</MenuItem>
        )}
        {!loading &&
          filteredOptions.map(workflow => (
            <MenuItem key={workflowKey(workflow)} value={workflowKey(workflow)}>
              {getWorkflowDisplayName(workflow)}
            </MenuItem>
          ))}
      </Select>
      {error && <FormHelperText error>{error}</FormHelperText>}
      {rawErrors?.length ? (
        <FormHelperText error>{rawErrors.join(', ')}</FormHelperText>
      ) : null}
      {schema.description && !rawErrors?.length && !error && (
        <FormHelperText>{schema.description}</FormHelperText>
      )}
    </FormControl>
  );
};

/*
 This is a validation function that will run when the form is submitted.
*/
export const buildWorkflowPickerValidation = (
  value: WorkflowSelection,
  validation: FieldValidation,
) => {
  if (!value || !value.name?.trim()) {
    validation.addError('Build workflow is required when using built-in CI');
  }
};
