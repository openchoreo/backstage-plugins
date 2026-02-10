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
  Grid,
} from '@material-ui/core';
import Autocomplete from '@material-ui/lab/Autocomplete';
import AddIcon from '@material-ui/icons/Add';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { GitSecretDialog } from '../GitSecretField/GitSecretDialog';

export interface GitSourceData {
  repo_url: string;
  branch: string;
  component_path: string;
  git_secret_ref: string;
}

interface GitSecret {
  name: string;
  namespace: string;
}

const CREATE_NEW_SECRET = '__create_new__';
const NO_SECRET = '__no_secret__';
const DIVIDER = '__divider__';

export const GitSourceFieldSchema = {
  returnValue: {
    type: 'object' as const,
    properties: {
      repo_url: { type: 'string' as const },
      branch: { type: 'string' as const },
      component_path: { type: 'string' as const },
      git_secret_ref: { type: 'string' as const },
    },
  },
};

export const GitSourceField = ({
  onChange,
  formData,
  uiSchema,
  rawErrors,
}: FieldExtensionComponentProps<GitSourceData>) => {
  const data: GitSourceData = {
    repo_url: formData?.repo_url ?? '',
    branch: formData?.branch ?? 'main',
    component_path: formData?.component_path ?? '.',
    git_secret_ref: formData?.git_secret_ref ?? '',
  };

  // Git secret state
  const [secrets, setSecrets] = useState<GitSecret[]>([]);
  const [secretsLoading, setSecretsLoading] = useState(false);
  const [secretsError, setSecretsError] = useState<string | null>(null);
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
    // If no namespace, still try to fetch — the field may work without it
    if (!nsName) {
      setSecrets([]);
      return;
    }

    setSecretsLoading(true);
    setSecretsError(null);

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
      setSecretsError(`Failed to fetch git secrets: ${err}`);
      setSecrets([]);
    } finally {
      setSecretsLoading(false);
    }
  }, [nsName, discoveryApi, fetchApi]);

  useEffect(() => {
    fetchSecrets();
  }, [fetchSecrets]);

  const updateField = (field: keyof GitSourceData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const handleCreateSecret = async (
    secretName: string,
    secretType: 'basic-auth' | 'ssh-auth',
    tokenOrKey: string,
    username?: string,
    sshKeyId?: string,
  ) => {
    try {
      const baseUrl = await discoveryApi.getBaseUrl('openchoreo');

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
          headers: { 'Content-Type': 'application/json' },
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

      await fetchSecrets();
      onChange({ ...data, git_secret_ref: secretName });
      setDialogOpen(false);
    } catch (err) {
      throw err;
    }
  };

  // Autocomplete options for git secret
  const secretOptions = [
    CREATE_NEW_SECRET,
    NO_SECRET,
    DIVIDER,
    ...(secretsLoading ? [] : secrets.map(s => s.name)),
  ];

  const handleSecretChange = (_event: any, value: string | null) => {
    if (value === CREATE_NEW_SECRET) {
      setDialogOpen(true);
      return;
    }
    if (value === NO_SECRET) {
      updateField('git_secret_ref', '');
      return;
    }
    if (value === DIVIDER) {
      return;
    }
    updateField('git_secret_ref', value || '');
  };

  const getSecretDisplayValue = () => {
    if (!data.git_secret_ref || data.git_secret_ref === '') return null;
    return data.git_secret_ref;
  };

  const hasError = !!rawErrors?.length;

  return (
    <Box>
      <Grid container spacing={2}>
        {/* Row 1: Git Repository URL (full width) */}
        <Grid item xs={12}>
          <TextField
            label="Git Repository URL"
            value={data.repo_url}
            onChange={e => updateField('repo_url', e.target.value)}
            fullWidth
            variant="outlined"
            required
            error={hasError && !data.repo_url}
            helperText="URL of the Git repository containing your source code"
          />
        </Grid>

        {/* Row 2: Branch (half) + Application Path (half) */}
        <Grid item xs={12} sm={6}>
          <TextField
            label="Branch"
            value={data.branch}
            onChange={e => updateField('branch', e.target.value)}
            fullWidth
            variant="outlined"
            required
            error={hasError && !data.branch}
            helperText="Git branch to build from"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Application Path"
            value={data.component_path}
            onChange={e => updateField('component_path', e.target.value)}
            fullWidth
            variant="outlined"
            helperText="Path to the application directory within the repository"
          />
        </Grid>

        {/* Row 3: Git Secret (full width) */}
        <Grid item xs={12}>
          <FormControl fullWidth error={!!secretsError}>
            <Autocomplete
              options={secretOptions}
              value={getSecretDisplayValue()}
              onChange={handleSecretChange}
              loading={secretsLoading}
              getOptionLabel={option => {
                if (option === CREATE_NEW_SECRET)
                  return 'Create New Git Secret';
                if (option === NO_SECRET) return 'No Secret';
                if (option === DIVIDER) return '';
                return option;
              }}
              renderOption={option => {
                if (option === CREATE_NEW_SECRET) {
                  return (
                    <Box display="flex" alignItems="center" style={{ gap: 8 }}>
                      <AddIcon fontSize="small" color="primary" />
                      <Typography color="primary">
                        Create New Git Secret
                      </Typography>
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
                  label="Git Secret"
                  variant="outlined"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {secretsLoading ? <CircularProgress size={20} /> : null}
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
            {secretsError && (
              <FormHelperText error>{secretsError}</FormHelperText>
            )}
            {!secretsError && (
              <FormHelperText>
                Secret reference for private repository credentials (optional
                for public repos)
              </FormHelperText>
            )}
          </FormControl>
        </Grid>
      </Grid>

      <GitSecretDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreateSecret}
        existingSecretNames={secrets.map(s => s.name)}
      />
    </Box>
  );
};

export const gitSourceFieldValidation = (
  value: GitSourceData,
  validation: FieldValidation,
) => {
  if (!value?.repo_url || value.repo_url.trim() === '') {
    validation.addError('Git Repository URL is required');
  }
  if (!value?.branch || value.branch.trim() === '') {
    validation.addError('Branch is required');
  }
};
