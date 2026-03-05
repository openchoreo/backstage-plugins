import { useState, useEffect, useCallback, useRef } from 'react';
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
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import {
  CHOREO_ANNOTATIONS,
  parseWorkflowParametersAnnotation,
} from '@openchoreo/backstage-plugin-common';
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
  formContext,
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
  const catalogApi = useApi(catalogApiRef);

  // Read the selected workflow name from formContext
  const selectedWorkflowName = formContext?.formData?.workflow_name;

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

  // Fetch WORKFLOW_PARAMETERS annotation from the selected Workflow entity
  const [visibleFields, setVisibleFields] = useState<Record<
    string,
    string
  > | null>(null);
  const [annotationLoaded, setAnnotationLoaded] = useState(false);

  useEffect(() => {
    let ignore = false;

    const fetchAnnotation = async () => {
      if (!selectedWorkflowName) {
        // No workflow selected — show all fields (backward compat)
        setVisibleFields(null);
        setAnnotationLoaded(true);
        return;
      }

      try {
        const response = await catalogApi.getEntities({
          filter: {
            kind: 'Workflow',
            'metadata.name': selectedWorkflowName,
            ...(nsName && { 'metadata.namespace': nsName }),
          },
        });

        if (ignore) return;

        const workflowEntity = response.items[0];
        const annotation =
          workflowEntity?.metadata?.annotations?.[
            CHOREO_ANNOTATIONS.WORKFLOW_PARAMETERS
          ];

        if (annotation) {
          setVisibleFields(parseWorkflowParametersAnnotation(annotation));
        } else {
          // No annotation — show all fields (backward compat)
          setVisibleFields(null);
        }
      } catch {
        if (!ignore) {
          // On error, fall back to showing all fields
          setVisibleFields(null);
        }
      } finally {
        if (!ignore) {
          setAnnotationLoaded(true);
        }
      }
    };

    setAnnotationLoaded(false);
    fetchAnnotation();
    return () => {
      ignore = true;
    };
  }, [selectedWorkflowName, catalogApi, nsName]);

  // Determine which fields to show
  const showRepoUrl = !visibleFields || 'repoUrl' in visibleFields;
  const showBranch = !visibleFields || 'branch' in visibleFields;
  const showAppPath = !visibleFields || 'appPath' in visibleFields;
  const showSecretRef = !visibleFields || 'secretRef' in visibleFields;

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

  // Prune hidden fields when visibility changes to avoid stale values in form data.
  // Refs ensure we read current values without re-triggering the effect on every render.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  useEffect(() => {
    if (!visibleFields) return; // No annotation — all fields visible, nothing to prune

    const visibleKeyCount = [
      showRepoUrl,
      showBranch,
      showAppPath,
      showSecretRef,
    ].filter(Boolean).length;
    // All fields visible — nothing to prune
    if (visibleKeyCount >= 4) return;

    const current = formDataRef.current;
    const pruned: Partial<GitSourceData> = {};
    if (showRepoUrl) pruned.repo_url = current?.repo_url ?? '';
    if (showBranch) pruned.branch = current?.branch ?? 'main';
    if (showAppPath) pruned.component_path = current?.component_path ?? '.';
    if (showSecretRef) pruned.git_secret_ref = current?.git_secret_ref ?? '';

    onChangeRef.current(pruned as GitSourceData);
  }, [showRepoUrl, showBranch, showAppPath, showSecretRef, visibleFields]);

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
    ...(nsName ? [CREATE_NEW_SECRET] : []),
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

  // Hide until a workflow is selected — we need the annotation to decide which fields to show
  if (!selectedWorkflowName || !annotationLoaded) {
    return null;
  }

  // If annotation defines no git fields, render nothing
  if (
    visibleFields &&
    !showRepoUrl &&
    !showBranch &&
    !showAppPath &&
    !showSecretRef
  ) {
    return null;
  }

  return (
    <Box>
      <Grid container spacing={2}>
        {/* Row 1: Git Repository URL (full width) */}
        {showRepoUrl && (
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
        )}

        {/* Row 2: Branch (half) + Application Path (half) */}
        {showBranch && (
          <Grid item xs={12} sm={showAppPath ? 6 : 12}>
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
        )}
        {showAppPath && (
          <Grid item xs={12} sm={showBranch ? 6 : 12}>
            <TextField
              label="Application Path"
              value={data.component_path}
              onChange={e => updateField('component_path', e.target.value)}
              fullWidth
              variant="outlined"
              helperText="Path to the application directory within the repository"
            />
          </Grid>
        )}

        {/* Row 3: Git Secret (full width) */}
        {showSecretRef && (
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
                      <Box
                        display="flex"
                        alignItems="center"
                        style={{ gap: 8 }}
                      >
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
                          {secretsLoading ? (
                            <CircularProgress size={20} />
                          ) : null}
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
        )}
      </Grid>

      {showSecretRef && (
        <GitSecretDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSubmit={handleCreateSecret}
          existingSecretNames={secrets.map(s => s.name)}
        />
      )}
    </Box>
  );
};

export const gitSourceFieldValidation = (
  value: GitSourceData,
  validation: FieldValidation,
) => {
  // Only validate fields that have values — conditional rendering
  // may hide some fields, so we only require them when present
  if (
    value?.repo_url !== undefined &&
    (!value.repo_url || value.repo_url.trim() === '')
  ) {
    validation.addError('Git Repository URL is required');
  }
  if (
    value?.branch !== undefined &&
    (!value.branch || value.branch.trim() === '')
  ) {
    validation.addError('Branch is required');
  }
};
