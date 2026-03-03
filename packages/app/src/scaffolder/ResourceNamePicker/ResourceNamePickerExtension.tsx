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

export const ResourceNamePickerSchema = {
  returnValue: { type: 'string' },
};

interface ValidationState {
  error: string | null;
  isValidating: boolean;
}

export const ResourceNamePicker = ({
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

  // Get configuration from ui:options
  const catalogKind =
    (uiSchema?.['ui:options']?.catalogKind as string) || 'Component';
  const resourceLabel =
    (uiSchema?.['ui:options']?.resourceLabel as string) || 'Resource';
  const namespaceField = uiSchema?.['ui:options']?.namespaceField as
    | string
    | undefined;

  // Get the namespace name from form context (only if namespaceField is specified)
  const namespaceName = namespaceField
    ? formContext.formData?.[namespaceField]
    : undefined;

  // Extract namespace name from entity reference format
  const extractNsName = useCallback((fullNsName: string): string => {
    if (!fullNsName) return '';
    const parts = fullNsName.split('/');
    return parts[parts.length - 1];
  }, []);

  // Validate resource name format (excluding required check - handled by JSON schema)
  const validateFormat = useCallback(
    (value: string): string | null => {
      // Empty value is allowed here - JSON schema handles required validation
      if (!value) {
        return null;
      }

      if (value.length > MAX_LENGTH) {
        return `${resourceLabel} name must not exceed ${MAX_LENGTH} characters`;
      }

      if (!K8S_NAME_PATTERN.test(value)) {
        if (value !== value.toLowerCase()) {
          return `${resourceLabel} name must be lowercase`;
        }
        if (!/^[a-z0-9]/.test(value)) {
          return `${resourceLabel} name must start with a lowercase letter or number`;
        }
        if (!/[a-z0-9]$/.test(value)) {
          return `${resourceLabel} name must end with a lowercase letter or number`;
        }
        return `${resourceLabel} name must contain only lowercase letters, numbers, hyphens, or dots`;
      }

      return null;
    },
    [resourceLabel],
  );

  // Check if resource already exists in the catalog
  const checkResourceExists = useCallback(
    async (resourceName: string, nsName?: string): Promise<boolean> => {
      if (!resourceName) {
        return false;
      }

      try {
        // Get all entities of the specified kind from catalog
        const { items } = await catalogApi.getEntities({
          filter: {
            kind: catalogKind,
          },
        });

        if (namespaceField && nsName) {
          // Namespaced resource: check by kind + namespace annotation + name
          // Exclude resources marked for deletion
          return items.some(
            entity =>
              entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ===
                nsName &&
              entity.metadata.name === resourceName &&
              !entity.metadata.annotations?.[
                CHOREO_ANNOTATIONS.DELETION_TIMESTAMP
              ],
          );
        }

        // Cluster-scoped resource: check by kind + name only
        // Exclude resources marked for deletion
        return items.some(
          entity =>
            entity.metadata.name === resourceName &&
            !entity.metadata.annotations?.[
              CHOREO_ANNOTATIONS.DELETION_TIMESTAMP
            ],
        );
      } catch {
        // On error, don't block - allow the user to proceed
        return false;
      }
    },
    [catalogApi, catalogKind, namespaceField],
  );

  // Debounced validation
  useEffect(() => {
    const validateAsync = async () => {
      const resourceName = formData || '';

      // First, validate format
      const formatError = validateFormat(resourceName);
      if (formatError) {
        setValidationState({ error: formatError, isValidating: false });
        return;
      }

      if (!resourceName) {
        setValidationState({ error: null, isValidating: false });
        return;
      }

      // For namespaced resources, we need the namespace to check duplicates
      if (namespaceField && !namespaceName) {
        setValidationState({ error: null, isValidating: false });
        return;
      }

      const nsName = namespaceField ? extractNsName(namespaceName) : undefined;
      if (namespaceField && !nsName) {
        setValidationState({ error: null, isValidating: false });
        return;
      }

      // Start validation
      setValidationState({ error: null, isValidating: true });

      // Check if resource exists
      const exists = await checkResourceExists(resourceName, nsName);

      if (exists) {
        const message = nsName
          ? `A ${resourceLabel} named "${resourceName}" already exists in namespace "${nsName}"`
          : `A ${resourceLabel} named "${resourceName}" already exists`;
        setValidationState({
          error: message,
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
    namespaceName,
    namespaceField,
    resourceLabel,
    validateFormat,
    checkResourceExists,
    extractNsName,
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
        label={
          uiSchema?.['ui:title'] || schema.title || `${resourceLabel} Name`
        }
        value={formData || ''}
        onChange={handleChange}
        onBlur={handleBlur}
        error={hasError}
        required={required}
        placeholder={`my-${resourceLabel
          .toLowerCase()
          .replace(/\s+/g, '-')}-name`}
        helperText={
          hasError && errorMessage
            ? errorMessage
            : `Unique name for your ${resourceLabel.toLowerCase()} (must be a valid Kubernetes name)`
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
export const resourceNamePickerValidation = (
  value: string,
  validation: FieldValidation,
) => {
  // Skip validation if empty - JSON schema handles required validation
  if (!value || value.trim() === '') {
    return;
  }

  if (value.length > MAX_LENGTH) {
    validation.addError(`Name must not exceed ${MAX_LENGTH} characters`);
    return;
  }

  if (!K8S_NAME_PATTERN.test(value)) {
    if (value !== value.toLowerCase()) {
      validation.addError('Name must be lowercase');
    } else if (!/^[a-z0-9]/.test(value)) {
      validation.addError('Name must start with a lowercase letter or number');
    } else if (!/[a-z0-9]$/.test(value)) {
      validation.addError('Name must end with a lowercase letter or number');
    } else {
      validation.addError(
        'Name must contain only lowercase letters, numbers, hyphens, or dots',
      );
    }
  }
};
