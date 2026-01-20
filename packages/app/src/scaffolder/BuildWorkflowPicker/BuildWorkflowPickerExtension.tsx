import { ChangeEvent, useState, useEffect } from 'react';
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

/*
 Schema for the Build Workflow Picker field
*/
export const BuildWorkflowPickerSchema = {
  returnValue: { type: 'string' as const },
};

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
}: FieldExtensionComponentProps<string>) => {
  const [workflowOptions, setWorkflowOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  // Get workflows from enum (if provided) or namespaceName from ui:options
  const enumWorkflows = (schema.enum as string[]) || null;
  const namespaceName =
    typeof uiSchema?.['ui:options']?.namespaceName === 'string'
      ? uiSchema['ui:options'].namespaceName
      : '';

  // Fetch workflows from API if enum is not provided
  useEffect(() => {
    let ignore = false;

    const fetchWorkflows = async () => {
      // If enum is provided, use it directly
      if (enumWorkflows && enumWorkflows.length > 0) {
        setWorkflowOptions(enumWorkflows);
        return;
      }

      // Otherwise, fetch from API
      if (!namespaceName) {
        setError('Organization name is required to fetch workflows');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const baseUrl = await discoveryApi.getBaseUrl('openchoreo-ci-backend');

        // Extract organization name if it's in entity reference format
        const extractOrgName = (fullOrgName: string): string => {
          const parts = fullOrgName.split('/');
          return parts[parts.length - 1];
        };

        const orgName = extractOrgName(namespaceName);

        // Use fetchApi which automatically injects Backstage + IDP tokens
        const response = await fetchApi.fetch(
          `${baseUrl}/workflows?namespaceName=${encodeURIComponent(
            orgName,
          )}`,
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (!ignore && result.success) {
          const workflows = result.data.items.map((item: any) => item.name);
          setWorkflowOptions(workflows);
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
  }, [namespaceName, enumWorkflows, discoveryApi, fetchApi]);

  const handleChange = (event: ChangeEvent<{ value: unknown }>) => {
    const selectedWorkflow = event.target.value as string;
    onChange(selectedWorkflow);
  };

  const label = uiSchema?.['ui:title'] || schema.title || 'Build Workflow';

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
        value={formData || ''}
        onChange={handleChange}
        disabled={loading || workflowOptions.length === 0}
      >
        {loading && (
          <MenuItem disabled>
            <CircularProgress size={20} style={{ marginRight: 8 }} />
            Loading workflows...
          </MenuItem>
        )}
        {!loading && workflowOptions.length === 0 && (
          <MenuItem disabled>No workflows available</MenuItem>
        )}
        {!loading &&
          workflowOptions.map(workflow => (
            <MenuItem key={workflow} value={workflow}>
              {workflow}
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
  value: string,
  validation: FieldValidation,
) => {
  if (!value || value.trim() === '') {
    validation.addError('Build workflow is required when using built-in CI');
  }
};
