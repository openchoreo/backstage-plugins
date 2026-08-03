import { useState } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { Box, TextField, Typography } from '@material-ui/core';

// OCI image reference pattern
// Supports: registry/image:tag, registry/image@sha256:digest, or just image:tag
const IMAGE_PATTERN =
  /^([a-z0-9]+([._-][a-z0-9]+)*)(\/[a-z0-9]+([._-][a-z0-9]+)*)*(:[a-zA-Z0-9][a-zA-Z0-9._-]*)?(@sha256:[a-f0-9]{64})?$/;

/**
 * Schema for the Container Image Field
 */
export const ContainerImageFieldSchema = {
  returnValue: {
    type: 'string' as const,
  },
};

/**
 * ContainerImageField component
 * Input field for container image references with validation
 */
export const ContainerImageField = ({
  onChange,
  formData,
  schema,
  rawErrors,
}: FieldExtensionComponentProps<string>) => {
  const [touched, setTouched] = useState(false);

  const value = formData || '';
  const isValid = !value || IMAGE_PATTERN.test(value);
  const showError = touched && value && !isValid;

  return (
    <Box mt={2}>
      <TextField
        fullWidth
        variant="outlined"
        label={schema.title || 'Container Image'}
        placeholder="e.g., ghcr.io/org/app:v1.0.0 or nginx:latest"
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        error={showError || (rawErrors && rawErrors.length > 0)}
        helperText={
          showError
            ? 'Enter a valid image reference (e.g., ghcr.io/org/app:v1.0.0)'
            : schema.description
        }
      />
      {schema.description && !showError && (
        <Typography
          variant="caption"
          color="textSecondary"
          style={{ marginTop: 4, display: 'block' }}
        >
          Supported formats: registry/image:tag, image:tag, or
          image@sha256:digest
        </Typography>
      )}
    </Box>
  );
};

/**
 * Validation function for container image field
 */
export const containerImageFieldValidation = (
  value: string,
  validation: any,
) => {
  if (!value || value.trim() === '') {
    validation.addError('Container image is required');
    return;
  }
  if (!IMAGE_PATTERN.test(value)) {
    validation.addError(
      'Invalid image reference format. Use registry/image:tag format.',
    );
  }
};
