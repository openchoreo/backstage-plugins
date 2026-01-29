import React, { useState, useEffect, useCallback } from 'react';
import { FieldProps } from '@rjsf/utils';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  CircularProgress,
  Button,
  Box,
} from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { GitSecretDialog } from './GitSecretDialog';

interface GitSecret {
  name: string;
  namespace: string;
}

/**
 * Custom RJSF field for selecting or creating git secrets.
 * This field is used when the workflow schema contains a secretRef field
 * in the systemParameters.repository section.
 */
export const GitSecretField: React.FC<FieldProps> = ({
  id,
  schema,
  uiSchema,
  formData,
  required,
  disabled,
  readonly,
  onChange,
  rawErrors,
  formContext,
}) => {
  const [secrets, setSecrets] = useState<GitSecret[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  // Get namespace from form context (the parent form's data)
  const namespaceName = formContext?.formData?.namespace_name;

  // Extract the actual namespace name from entity reference format if needed
  const extractNsName = (fullNsName: string): string => {
    if (!fullNsName) return '';
    const parts = fullNsName.split('/');
    return parts[parts.length - 1];
  };

  const nsName = extractNsName(namespaceName);

  // Fetch available git secrets
  const fetchSecrets = useCallback(async () => {
    if (!nsName) {
      setSecrets([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const baseUrl = await discoveryApi.getBaseUrl('openchoreo');
      const response = await fetchApi.fetch(
        `${baseUrl}/git-secrets?namespaceName=${encodeURIComponent(nsName)}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      setSecrets(result.items || []);
    } catch (err) {
      setError(`Failed to fetch git secrets: ${err}`);
      setSecrets([]);
    } finally {
      setLoading(false);
    }
  }, [nsName, discoveryApi, fetchApi]);

  // Fetch secrets on mount and when namespace changes
  useEffect(() => {
    fetchSecrets();
  }, [fetchSecrets]);

  const handleChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const value = event.target.value as string;
    onChange(value || undefined);
  };

  const handleCreateSecret = async (secretName: string, token: string) => {
    try {
      const baseUrl = await discoveryApi.getBaseUrl('openchoreo');
      const response = await fetchApi.fetch(
        `${baseUrl}/git-secrets?namespaceName=${encodeURIComponent(nsName)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ secretName, token }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`,
        );
      }

      // Refresh the secrets list
      await fetchSecrets();

      // Select the newly created secret
      onChange(secretName);

      setDialogOpen(false);
    } catch (err) {
      throw err; // Let the dialog handle the error
    }
  };

  const label = schema.title || uiSchema?.['ui:title'] || 'Git Secret';
  const description = schema.description || uiSchema?.['ui:description'];

  return (
    <Box>
      <Box display="flex" alignItems="flex-end" gap={1}>
        <FormControl
          fullWidth
          margin="normal"
          variant="outlined"
          error={!!rawErrors?.length || !!error}
          required={required}
          disabled={disabled || readonly || loading}
        >
          <InputLabel id={`${id}-label`}>{label}</InputLabel>
          <Select
            labelId={`${id}-label`}
            label={label}
            value={formData || ''}
            onChange={handleChange}
          >
            {/* Empty option for optional field */}
            {!required && (
              <MenuItem value="">
                <em>None (public repository)</em>
              </MenuItem>
            )}

            {loading && (
              <MenuItem disabled>
                <CircularProgress size={20} style={{ marginRight: 8 }} />
                Loading secrets...
              </MenuItem>
            )}

            {!loading && secrets.length === 0 && (
              <MenuItem disabled>
                {nsName
                  ? 'No git secrets available'
                  : 'Select a namespace first'}
              </MenuItem>
            )}

            {!loading &&
              secrets.map(secret => (
                <MenuItem key={secret.name} value={secret.name}>
                  {secret.name}
                </MenuItem>
              ))}
          </Select>

          {error && <FormHelperText error>{error}</FormHelperText>}
          {rawErrors?.length ? (
            <FormHelperText error>{rawErrors.join(', ')}</FormHelperText>
          ) : null}
          {description && !rawErrors?.length && !error && (
            <FormHelperText>{description}</FormHelperText>
          )}
        </FormControl>

        <Button
          variant="outlined"
          color="primary"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
          disabled={disabled || readonly || !nsName}
          style={{ marginBottom: 8, whiteSpace: 'nowrap' }}
        >
          Create
        </Button>
      </Box>

      <GitSecretDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreateSecret}
        namespaceName={nsName}
      />
    </Box>
  );
};
