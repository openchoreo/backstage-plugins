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
  Tooltip,
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
  CHOREO_LABELS,
  GIT_SECRET_TYPE_VALUE,
} from '@openchoreo/backstage-plugin-common';
import { useSecretManagementEnabled } from '@openchoreo/backstage-plugin-react';
import { CLUSTER_WORKFLOW_NAMESPACE } from '../types';
import { GitSecretDialog } from './GitSecretDialog';

interface GitSecret {
  name: string;
  namespace: string;
}

// K8s Secret types used by git secrets.
const K8S_BASIC_AUTH = 'kubernetes.io/basic-auth';
const K8S_SSH_AUTH = 'kubernetes.io/ssh-auth';

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
 *
 * Backed by the generic `/secrets` API: git secrets are SecretReferences
 * carrying the `openchoreo.dev/secret-type: git-credentials` label. The target
 * workflow plane is derived from the workflow selected earlier in the form.
 */
export const GitSecretField = ({
  onChange,
  formData,
  schema,
  uiSchema,
  rawErrors,
  idSchema,
  formContext,
}: FieldExtensionComponentProps<string>) => {
  const [secrets, setSecrets] = useState<GitSecret[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Workflow plane info, derived from the selected workflow entity's annotations.
  const [workflowPlaneRef, setWorkflowPlaneRef] = useState<string | undefined>(
    undefined,
  );
  const [workflowPlaneRefKind, setWorkflowPlaneRefKind] = useState<
    string | undefined
  >(undefined);

  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const catalogApi = useApi(catalogApiRef);
  const secretManagementEnabled = useSecretManagementEnabled();

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

  // Read the selected workflow from formContext (object with kind and name).
  const selectedWorkflow = formContext?.formData?.workflow_name as
    | { kind?: string; name?: string }
    | undefined;
  const selectedWorkflowName =
    selectedWorkflow &&
    typeof selectedWorkflow === 'object' &&
    selectedWorkflow.name
      ? selectedWorkflow.name
      : undefined;
  const selectedWorkflowKind = selectedWorkflow?.kind;

  // Fetch available git secrets (generic secrets carrying the git-credentials label)
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
        `${baseUrl}/secrets?namespaceName=${encodeURIComponent(nsName)}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      const items: GitSecret[] = (result.items || [])
        .filter(
          (s: { labels?: Record<string, string> }) =>
            s.labels?.[CHOREO_LABELS.SECRET_TYPE] === GIT_SECRET_TYPE_VALUE,
        )
        .map((s: { name: string; namespace: string }) => ({
          name: s.name,
          namespace: s.namespace,
        }));
      setSecrets(items);
    } catch (err) {
      setError(`Failed to fetch git secrets: ${err}`);
      setSecrets([]);
    } finally {
      setLoading(false);
    }
  }, [nsName, discoveryApi, fetchApi]);

  // Resolve the target workflow plane from the selected workflow's annotations.
  useEffect(() => {
    let ignore = false;

    const fetchWorkflowPlane = async () => {
      if (!selectedWorkflowName) {
        setWorkflowPlaneRef(undefined);
        setWorkflowPlaneRefKind(undefined);
        return;
      }

      try {
        const filter: Record<string, string> = {
          'metadata.name': selectedWorkflowName,
        };
        if (selectedWorkflowKind === 'ClusterWorkflow') {
          filter.kind = 'ClusterWorkflow';
          filter['metadata.namespace'] = CLUSTER_WORKFLOW_NAMESPACE;
        } else {
          filter.kind = 'Workflow';
          if (nsName) filter['metadata.namespace'] = nsName;
        }

        const response = await catalogApi.getEntities({ filter });
        if (ignore) return;

        const workflowEntity = response.items[0];
        setWorkflowPlaneRef(
          workflowEntity?.metadata?.annotations?.[
            CHOREO_ANNOTATIONS.WORKFLOW_PLANE_REF
          ],
        );
        setWorkflowPlaneRefKind(
          workflowEntity?.metadata?.annotations?.[
            CHOREO_ANNOTATIONS.WORKFLOW_PLANE_REF_KIND
          ],
        );
      } catch {
        if (!ignore) {
          setWorkflowPlaneRef(undefined);
          setWorkflowPlaneRefKind(undefined);
        }
      }
    };

    fetchWorkflowPlane();
    return () => {
      ignore = true;
    };
  }, [selectedWorkflowName, selectedWorkflowKind, catalogApi, nsName]);

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
    if (!workflowPlaneRefKind || !workflowPlaneRef) {
      throw new Error(
        'No workflow plane is associated with the selected workflow.',
      );
    }

    try {
      const baseUrl = await discoveryApi.getBaseUrl('openchoreo');

      // Build the K8s Secret data map for the chosen auth type.
      let k8sSecretType: string;
      const data: Record<string, string> = {};
      if (secretType === 'basic-auth') {
        k8sSecretType = K8S_BASIC_AUTH;
        data.password = tokenOrKey;
        if (username) data.username = username;
      } else {
        k8sSecretType = K8S_SSH_AUTH;
        data['ssh-privatekey'] = tokenOrKey;
        if (sshKeyId) data['ssh-key-id'] = sshKeyId;
      }

      const requestBody = {
        secretName,
        secretType: k8sSecretType,
        targetPlane: {
          kind: workflowPlaneRefKind,
          name: workflowPlaneRef,
        },
        data,
        labels: { [CHOREO_LABELS.SECRET_TYPE]: GIT_SECRET_TYPE_VALUE },
      };

      const response = await fetchApi.fetch(
        `${baseUrl}/secrets?namespaceName=${encodeURIComponent(nsName)}`,
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

  // Creating a new git secret needs a workflow plane to target.
  const canCreateSecret =
    secretManagementEnabled && !!workflowPlaneRefKind && !!workflowPlaneRef;
  const createDisabledReason = !secretManagementEnabled
    ? 'Secret management is disabled. Enable it to create new git secrets.'
    : 'Select a workflow first so the secret can target its workflow plane.';

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
      if (!canCreateSecret) return;
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
              if (!canCreateSecret) {
                return (
                  <Tooltip title={createDisabledReason}>
                    <Box
                      display="flex"
                      alignItems="center"
                      style={{ gap: 8 }}
                    >
                      <AddIcon fontSize="small" color="disabled" />
                      <Typography color="textSecondary">
                        Create New Git Secret
                      </Typography>
                    </Box>
                  </Tooltip>
                );
              }
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
          getOptionDisabled={option =>
            option === DIVIDER ||
            (option === CREATE_NEW_SECRET && !canCreateSecret)
          }
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
