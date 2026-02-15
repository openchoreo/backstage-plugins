import { useState, useEffect, useCallback } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import type { FieldValidation } from '@rjsf/utils';
import {
  FormControl,
  FormHelperText,
  CircularProgress,
  Box,
  TextField,
  Divider,
  Typography,
} from '@material-ui/core';
import Autocomplete from '@material-ui/lab/Autocomplete';
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

// Special option types
const CREATE_NEW_SECRET = '__create_new__';
const NO_SECRET = '__no_secret__';
const DIVIDER = '__divider__';

/*
 Schema for the Git Secret Field
*/
export const GitSecretFieldSchema = {
  returnValue: { type: 'string' as const },
};

/**
 * Scaffolder field extension for selecting or creating git secrets.
 * Shows an autocomplete dropdown with existing secrets and an option to create new ones.
 */
export const GitSecretField = ({
  onChange,
  formData,
  schema,
  uiSchema,
  rawErrors,
  idSchema,
}: FieldExtensionComponentProps<string>) => {
  const [secrets, setSecrets] = useState<GitSecret[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  // Get namespace from ui:options (set by the converter)
  const namespaceName =
    typeof uiSchema?.['ui:options']?.namespaceName === 'string'
      ? uiSchema['ui:options'].namespaceName
      : '';

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

  const handleCreateSecret = async (
    secretName: string,
    secretType: 'basic-auth' | 'ssh-auth',
    tokenOrKey: string,
    username?: string,
    sshKeyId?: string,
  ) => {
    try {
      const baseUrl = await discoveryApi.getBaseUrl('openchoreo');

      // Construct request body based on secret type
      const requestBody: any = {
        secretName,
        secretType,
      };

      if (secretType === 'basic-auth') {
        requestBody.token = tokenOrKey;
        if (username) {
          requestBody.username = username;
        }
      } else {
        requestBody.sshKey = tokenOrKey;
        if (sshKeyId) {
          requestBody.sshKeyId = sshKeyId;
        }
      }

      const response = await fetchApi.fetch(
        `${baseUrl}/git-secrets?namespaceName=${encodeURIComponent(nsName)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            `HTTP ${response.status}: ${response.statusText}`,
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

  const label = uiSchema?.['ui:title'] || schema.title || 'Git Secret';
  const description = uiSchema?.['ui:description'] || schema.description;

  // Build options array for Autocomplete
  const options = [
    CREATE_NEW_SECRET,
    NO_SECRET,
    DIVIDER,
    ...(loading ? [] : secrets.map(s => s.name)),
  ];

  // Handle selection
  const handleAutocompleteChange = (_event: any, value: string | null) => {
    if (value === CREATE_NEW_SECRET) {
      setDialogOpen(true);
      return;
    }
    if (value === NO_SECRET) {
      onChange('');
      return;
    }
    if (value === DIVIDER) {
      return;
    }
    onChange(value || undefined);
  };

  // Get display value for selected option
  const getDisplayValue = () => {
    if (!formData || formData === '') return null;
    return formData;
  };

  return (
    <Box>
      <FormControl
        fullWidth
        margin="normal"
        error={!!rawErrors?.length || !!error}
      >
        <Autocomplete
          id={idSchema?.$id}
          options={options}
          value={getDisplayValue()}
          onChange={handleAutocompleteChange}
          loading={loading}
          getOptionLabel={option => {
            if (option === CREATE_NEW_SECRET) return 'Create New Git Secret';
            if (option === NO_SECRET) return 'No Secret';
            if (option === DIVIDER) return '';
            return option;
          }}
          renderOption={option => {
            if (option === CREATE_NEW_SECRET) {
              return (
                <Box display="flex" alignItems="center" style={{ gap: 8 }}>
                  <AddIcon fontSize="small" color="primary" />
                  <Typography color="primary">Create New Git Secret</Typography>
                </Box>
              );
            }
            if (option === NO_SECRET) {
              return <Typography>No Secret</Typography>;
            }
            if (option === DIVIDER) {
              return <Divider style={{ margin: 0, width: '100%' }} />;
            }
            return <Typography>{option}</Typography>;
          }}
          getOptionDisabled={option => option === DIVIDER}
          renderInput={params => (
            <TextField
              {...params}
              label={label}
              variant="outlined"
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loading ? <CircularProgress size={20} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
          noOptionsText={
            !nsName ? 'Select a namespace first' : 'No git secrets available'
          }
        />

        {error && <FormHelperText error>{error}</FormHelperText>}
        {rawErrors?.length ? (
          <FormHelperText error>{rawErrors.join(', ')}</FormHelperText>
        ) : null}
        {description && !rawErrors?.length && !error && (
          <FormHelperText>{description}</FormHelperText>
        )}
      </FormControl>

      <GitSecretDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreateSecret}
        existingSecretNames={secrets.map(s => s.name)}
      />
    </Box>
  );
};

/*
 Validation function for the Git Secret Field.
 Secret is optional, so no validation needed.
*/
export const gitSecretFieldValidation = (
  _value: string,
  _validation: FieldValidation,
) => {
  // No validation — secretRef is optional
};
