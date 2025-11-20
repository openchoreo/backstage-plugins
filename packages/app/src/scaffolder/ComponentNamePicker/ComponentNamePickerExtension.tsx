import { ChangeEvent, useEffect, useState, useCallback } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import type { FieldValidation } from '@rjsf/utils';
import {
  FormControl,
  TextField,
  CircularProgress,
  InputAdornment,
} from '@material-ui/core';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

// Kubernetes DNS subdomain name validation
// - Must be lowercase alphanumeric characters, '-' or '.'
// - Must start and end with an alphanumeric character
// - Maximum length 253 characters
const K8S_NAME_PATTERN =
  /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;
const MAX_LENGTH = 253;

export const ComponentNamePickerSchema = {
  returnValue: { type: 'string' },
};

interface ValidationState {
  error: string | null;
  isValidating: boolean;
}

export const ComponentNamePicker = ({
  onChange,
  rawErrors,
  required,
  formData,
  formContext,
  idSchema,
  uiSchema,
  schema,
}: FieldExtensionComponentProps<string>) => {
  const [validationState, setValidationState] = useState<ValidationState>({
    error: null,
    isValidating: false,
  });
  const [touched, setTouched] = useState(false);
  const catalogApi = useApi(catalogApiRef);

  // Get the organization name from form context
  const organizationName = formContext.formData?.organization_name;

  // Extract organization name from entity reference format
  const extractOrgName = useCallback((fullOrgName: string): string => {
    if (!fullOrgName) return '';
    const parts = fullOrgName.split('/');
    return parts[parts.length - 1];
  }, []);

  // Validate component name format (excluding required check - handled by JSON schema)
  const validateFormat = useCallback((value: string): string | null => {
    // Empty value is allowed here - JSON schema handles required validation
    if (!value) {
      return null;
    }

    if (value.length > MAX_LENGTH) {
      return `Component name must not exceed ${MAX_LENGTH} characters`;
    }

    if (!K8S_NAME_PATTERN.test(value)) {
      if (value !== value.toLowerCase()) {
        return 'Component name must be lowercase';
      }
      if (!/^[a-z0-9]/.test(value)) {
        return 'Component name must start with a lowercase letter or number';
      }
      if (!/[a-z0-9]$/.test(value)) {
        return 'Component name must end with a lowercase letter or number';
      }
      return 'Component name must contain only lowercase letters, numbers, hyphens, or dots';
    }

    return null;
  }, []);

  // Check if component already exists in the organization
  const checkComponentExists = useCallback(
    async (componentName: string, orgName: string): Promise<boolean> => {
      if (!componentName || !orgName) {
        return false;
      }

      try {
        // Get all components from catalog
        const { items } = await catalogApi.getEntities({
          filter: {
            kind: 'Component',
          },
        });

        // Filter components by organization annotation and check if name exists
        const existsInOrg = items.some(
          component =>
            component.metadata.annotations?.[
              CHOREO_ANNOTATIONS.ORGANIZATION
            ] === orgName && component.metadata.name === componentName,
        );

        return existsInOrg;
      } catch (error) {
        // On error, don't block - allow the user to proceed
        return false;
      }
    },
    [catalogApi],
  );

  // Debounced validation
  useEffect(() => {
    const validateAsync = async () => {
      const componentName = formData || '';

      // First, validate format
      const formatError = validateFormat(componentName);
      if (formatError) {
        setValidationState({ error: formatError, isValidating: false });
        return;
      }

      if (!componentName || !organizationName) {
        setValidationState({ error: null, isValidating: false });
        return;
      }

      const orgName = extractOrgName(organizationName);
      if (!orgName) {
        setValidationState({ error: null, isValidating: false });
        return;
      }

      // Start validation
      setValidationState({ error: null, isValidating: true });

      // Check if component exists
      const exists = await checkComponentExists(componentName, orgName);

      if (exists) {
        setValidationState({
          error: `A component named "${componentName}" already exists in organization "${orgName}"`,
          isValidating: false,
        });
      } else {
        setValidationState({ error: null, isValidating: false });
      }
    };

    // Debounce validation by 500ms
    const timeoutId = setTimeout(validateAsync, 500);

    return () => clearTimeout(timeoutId);
  }, [
    formData,
    organizationName,
    validateFormat,
    checkComponentExists,
    extractOrgName,
  ]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTouched(true);
    onChange(event.target.value);
  };

  const handleBlur = () => {
    setTouched(true);
  };

  // Only show validation errors if the field has been touched or if there are submission errors (rawErrors)
  const shouldShowError = touched || !!rawErrors?.length;
  const hasError =
    shouldShowError && (!!rawErrors?.length || !!validationState.error);
  const errorMessage = rawErrors?.[0] || validationState.error;

  return (
    <FormControl fullWidth margin="normal" error={hasError} required={required}>
      <TextField
        id={idSchema?.$id}
        label={uiSchema?.['ui:title'] || schema.title || 'Component Name'}
        value={formData || ''}
        onChange={handleChange}
        onBlur={handleBlur}
        error={hasError}
        required={required}
        placeholder="my-component-name"
        helperText={
          hasError && errorMessage
            ? errorMessage
            : schema.description ||
              'Lowercase letters, numbers, hyphens, and dots only. Must start and end with alphanumeric character.'
        }
        InputProps={{
          endAdornment: validationState.isValidating ? (
            <InputAdornment position="end">
              <CircularProgress size={20} />
            </InputAdornment>
          ) : null,
        }}
      />
    </FormControl>
  );
};

/**
 * Validation function that runs on form submission
 * Note: Required field validation is handled by JSON schema
 */
export const componentNamePickerValidation = (
  value: string,
  validation: FieldValidation,
) => {
  // Skip validation if empty - JSON schema handles required validation
  if (!value || value.trim() === '') {
    return;
  }

  if (value.length > MAX_LENGTH) {
    validation.addError(
      `Component name must not exceed ${MAX_LENGTH} characters`,
    );
    return;
  }

  if (!K8S_NAME_PATTERN.test(value)) {
    if (value !== value.toLowerCase()) {
      validation.addError('Component name must be lowercase');
    } else if (!/^[a-z0-9]/.test(value)) {
      validation.addError(
        'Component name must start with a lowercase letter or number',
      );
    } else if (!/[a-z0-9]$/.test(value)) {
      validation.addError(
        'Component name must end with a lowercase letter or number',
      );
    } else {
      validation.addError(
        'Component name must contain only lowercase letters, numbers, hyphens, or dots',
      );
    }
  }
};
