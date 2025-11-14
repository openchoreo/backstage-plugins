import { ChangeEvent } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import type { FieldValidation } from '@rjsf/utils';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
} from '@material-ui/core';

/*
 Schema for the Build Workflow Picker field
*/
export const BuildWorkflowPickerSchema = {
  returnValue: { type: 'string' as const },
};

/*
 This is the actual component that will get rendered in the form

 Note: The workflows are defined via enum in the schema (from allowedWorkflows in CTD).
 This component handles workflow selection, and the BuildWorkflowParameters component
 (which is a sibling field) reads the selected workflow from formData to fetch its schema.
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
  const workflowOptions = (schema.enum as string[]) || [];

  const handleChange = (event: ChangeEvent<{ value: unknown }>) => {
    const selectedWorkflow = event.target.value as string;
    onChange(selectedWorkflow);
  };

  return (
    <FormControl
      fullWidth
      margin="normal"
      error={!!rawErrors?.length}
      required={required}
    >
      <InputLabel id={`${idSchema?.$id}-label`}>
        {uiSchema?.['ui:title'] || schema.title || 'Build Workflow'}
      </InputLabel>
      <Select
        labelId={`${idSchema?.$id}-label`}
        value={formData || ''}
        onChange={handleChange}
        disabled={workflowOptions.length === 0}
      >
        {workflowOptions.length === 0 && (
          <MenuItem disabled>No workflows available</MenuItem>
        )}
        {workflowOptions.map(workflow => (
          <MenuItem key={workflow} value={workflow}>
            {workflow}
          </MenuItem>
        ))}
      </Select>
      {rawErrors?.length ? (
        <FormHelperText>{rawErrors.join(', ')}</FormHelperText>
      ) : null}
      {schema.description && !rawErrors?.length && (
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
