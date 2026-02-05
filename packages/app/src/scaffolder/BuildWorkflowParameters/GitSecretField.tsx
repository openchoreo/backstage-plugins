import { useState, useEffect, useCallback } from 'react';
import { FieldProps } from '@rjsf/utils';
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

/**
 * Custom RJSF field for selecting or creating git secrets.
 * This field is used when the workflow schema contains a secretRef field
 * in the systemParameters.repository section.
 */
export const GitSecretField = ({
  id,
  schema,
  uiSchema,
  formData,
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
  // Support both nested (project_namespace.namespace_name) and flat (namespace_name) formats
  const namespaceName =
    formContext?.formData?.project_namespace?.namespace_name ||
    formContext?.formData?.namespace_name;

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
      } else {
        requestBody.sshKey = tokenOrKey;
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

  const label = schema.title || uiSchema?.['ui:title'] || 'Secret Reference';
  const description = schema.description || uiSchema?.['ui:description'];

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
      // Divider is not selectable, do nothing
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
          id={id}
          options={options}
          value={getDisplayValue()}
          onChange={handleAutocompleteChange}
          disabled={disabled || readonly}
          loading={loading}
          getOptionLabel={(option) => {
            if (option === CREATE_NEW_SECRET) return 'Create New Git Secret';
            if (option === NO_SECRET) return 'No Secret';
            if (option === DIVIDER) return '';
            return option;
          }}
          renderOption={(option) => {
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
          getOptionDisabled={(option) => option === DIVIDER}
          renderInput={(params) => (
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
            !nsName
              ? 'Select a namespace first'
              : 'No git secrets available'
          }
        />

        {error && (
          <FormHelperText
            error
            style={{
              marginLeft: 0,
              marginTop: 8,
              fontSize: '0.75rem',
              fontWeight: 400,
            }}
          >
            {error}
          </FormHelperText>
        )}
        {rawErrors?.length ? (
          <FormHelperText
            error
            style={{
              marginLeft: 0,
              marginTop: 8,
              fontSize: '0.75rem',
              fontWeight: 400,
            }}
          >
            {rawErrors.join(', ')}
          </FormHelperText>
        ) : null}
        {description && !rawErrors?.length && !error && (
          <FormHelperText
            style={{
              marginLeft: 0,
              marginTop: 8,
              fontSize: '0.9rem',
              fontWeight: 500,
              color: 'rgba(0, 0, 0, 0.54)',
            }}
          >
            {description}
          </FormHelperText>
        )}
      </FormControl>

      <GitSecretDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreateSecret}
        namespaceName={nsName}
      />
    </Box>
  );
};
