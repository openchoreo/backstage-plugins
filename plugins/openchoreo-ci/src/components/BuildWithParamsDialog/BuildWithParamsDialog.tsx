import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  TextField,
  Grid,
} from '@material-ui/core';
import Autocomplete from '@material-ui/lab/Autocomplete';
import Form from '@rjsf/material-ui';
import {
  ArrayFieldTemplate,
  DescriptionFieldTemplate,
  TitleFieldTemplate,
} from '@openchoreo/backstage-design-system';
import validator from '@rjsf/validator-ajv8';
import { JSONSchema7 } from 'json-schema';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { openChoreoCiClientApiRef } from '../../api/OpenChoreoCiClientApi';
import {
  CHOREO_ANNOTATIONS,
  filterEmptyObjectProperties,
} from '@openchoreo/backstage-plugin-common';
import { addTitlesToSchema } from '../WorkflowConfigPage/EditWorkflowConfigs/utils';
import {
  walkSchemaForGitFields,
  getNestedValue,
  setNestedValue,
} from '../../utils/schemaExtensions';
import { useStyles } from './styles';

/**
 * Git field display config.
 * - editable: whether the user can change this value per-build
 * - hidden: whether the field is hidden entirely (implementation details)
 */
const GIT_FIELD_CONFIG: Record<
  string,
  {
    label: string;
    helperText: string;
    order: number;
    editable: boolean;
    hidden: boolean;
  }
> = {
  repoUrl: {
    label: 'Git Repository URL',
    helperText: 'URL of the Git repository containing your source code',
    order: 0,
    editable: false,
    hidden: false,
  },
  branch: {
    label: 'Branch',
    helperText: 'Git branch to build from',
    order: 1,
    editable: true,
    hidden: false,
  },
  appPath: {
    label: 'Application Path',
    helperText: 'Path to the application directory within the repository',
    order: 2,
    editable: false,
    hidden: false,
  },
  commit: {
    label: 'Commit',
    helperText: 'Git commit SHA or reference (optional, defaults to latest)',
    order: 3,
    editable: true,
    hidden: false,
  },
  secretRef: {
    label: 'Git Secret',
    helperText:
      'Secret reference for private repository credentials (optional for public repos)',
    order: 4,
    editable: true,
    hidden: false,
  },
};

// ─── Schema helpers ─────────────────────────────────────────────────────────

function getGitFilteredTopLevelKeys(
  mapping: Record<string, string>,
): Set<string> {
  const keys = new Set<string>();
  for (const path of Object.values(mapping)) {
    const topKey = path.split('.')[0];
    if (topKey) keys.add(topKey);
  }
  return keys;
}

function unwrapParametersSchema(schema: JSONSchema7): JSONSchema7 {
  const innerParams = schema.properties?.parameters;
  if (
    innerParams &&
    typeof innerParams === 'object' &&
    !Array.isArray(innerParams) &&
    (innerParams as JSONSchema7).properties
  ) {
    const inner = innerParams as JSONSchema7;
    return {
      ...schema,
      ...inner,
      properties: inner.properties,
    };
  }
  return schema;
}

// ─── Component ──────────────────────────────────────────────────────────────

interface BuildWithParamsDialogProps {
  open: boolean;
  onClose: () => void;
  onTrigger: (parameters: Record<string, unknown>) => Promise<void>;
  isLoading?: boolean;
  workflowName: string;
  workflowKind?: 'Workflow' | 'ClusterWorkflow';
  currentParameters?: Record<string, unknown> | null;
}

export const BuildWithParamsDialog = ({
  open,
  onClose,
  onTrigger,
  isLoading = false,
  workflowName,
  workflowKind,
  currentParameters,
}: BuildWithParamsDialogProps) => {
  const classes = useStyles();
  const { entity } = useEntity();
  const client = useApi(openChoreoCiClientApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const [schema, setSchema] = useState<JSONSchema7 | null>(null);
  const [rawUnwrappedSchema, setRawUnwrappedSchema] =
    useState<JSONSchema7 | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [gitFieldValues, setGitFieldValues] = useState<Record<string, string>>(
    {},
  );
  const [error, setError] = useState('');
  const [gitSecrets, setGitSecrets] = useState<string[]>([]);
  const [secretsLoading, setSecretsLoading] = useState(false);

  const namespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ?? '';

  // Fetch available git secrets
  const fetchGitSecrets = useCallback(async () => {
    if (!namespace) return;
    setSecretsLoading(true);
    try {
      const baseUrl = await discoveryApi.getBaseUrl('openchoreo');
      const response = await fetchApi.fetch(
        `${baseUrl}/git-secrets?namespaceName=${encodeURIComponent(namespace)}`,
      );
      if (response.ok) {
        const result = await response.json();
        setGitSecrets(
          (result.items || []).map((s: { name: string }) => s.name),
        );
      }
    } catch {
      // Silently fail — dropdown will just be empty
    } finally {
      setSecretsLoading(false);
    }
  }, [namespace, discoveryApi, fetchApi]);

  // Detect git fields from the schema extensions
  const gitFieldMapping = useMemo<Record<string, string>>(() => {
    if (!rawUnwrappedSchema?.properties) return {};
    return walkSchemaForGitFields(
      rawUnwrappedSchema.properties as Record<string, any>,
      '',
    );
  }, [rawUnwrappedSchema]);

  // Build ordered, visible git field list for rendering
  const gitFields = useMemo(() => {
    return Object.entries(gitFieldMapping)
      .filter(
        ([key]) => key in GIT_FIELD_CONFIG && !GIT_FIELD_CONFIG[key].hidden,
      )
      .map(([key, path]) => ({ key, path, ...GIT_FIELD_CONFIG[key] }))
      .sort((a, b) => a.order - b.order);
  }, [gitFieldMapping]);

  // All git fields (including hidden) — needed for filtering schema and merging on submit
  const allGitFields = useMemo(() => {
    return Object.entries(gitFieldMapping)
      .filter(([key]) => key in GIT_FIELD_CONFIG)
      .map(([key, path]) => ({ key, path }));
  }, [gitFieldMapping]);

  const hasGitFields = gitFields.length > 0;

  // Top-level schema properties to filter from the RJSF form
  const gitFilterKeys = useMemo(
    () => getGitFilteredTopLevelKeys(gitFieldMapping),
    [gitFieldMapping],
  );

  // Schema with git-related top-level properties removed
  const filteredSchema = useMemo<JSONSchema7 | null>(() => {
    if (!schema || gitFilterKeys.size === 0) return schema;
    if (!schema.properties) return schema;

    const props: Record<string, any> = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      if (!gitFilterKeys.has(key)) {
        props[key] = value;
      }
    }
    return {
      ...schema,
      properties: props,
      required: schema.required
        ? (schema.required as string[]).filter(r => !gitFilterKeys.has(r))
        : undefined,
    };
  }, [schema, gitFilterKeys]);

  const hasRemainingSchemaFields =
    filteredSchema?.properties &&
    Object.keys(filteredSchema.properties).length > 0;

  const loadSchema = useCallback(async () => {
    if (!workflowName) return;

    setSchemaLoading(true);
    setSchemaError(null);

    try {
      if (!namespace) {
        throw new Error('Namespace not found in entity');
      }

      const schemaResponse = await client.fetchWorkflowSchema(
        namespace,
        workflowName,
        workflowKind,
      );

      const rawSchema = (
        schemaResponse.success !== undefined && schemaResponse.data
          ? schemaResponse.data
          : schemaResponse
      ) as JSONSchema7;

      if (!rawSchema || typeof rawSchema !== 'object') {
        throw new Error('Failed to fetch workflow schema');
      }

      const cleaned = filterEmptyObjectProperties(rawSchema);
      const unwrapped = unwrapParametersSchema(cleaned);

      setRawUnwrappedSchema(unwrapped);
      setSchema(addTitlesToSchema(unwrapped));
    } catch (err) {
      setSchemaError(
        err instanceof Error ? err.message : 'Failed to load workflow schema',
      );
    } finally {
      setSchemaLoading(false);
    }
  }, [namespace, client, workflowName, workflowKind]);

  // Load schema, secrets, and reset form data when dialog opens
  useEffect(() => {
    if (open) {
      loadSchema();
      fetchGitSecrets();
      const params = currentParameters
        ? JSON.parse(JSON.stringify(currentParameters))
        : {};
      setFormData(params);
      setGitFieldValues({});
      setError('');
    }
  }, [open, loadSchema, fetchGitSecrets, currentParameters]);

  // Populate git field values once schema extensions are detected
  useEffect(() => {
    if (allGitFields.length === 0 || !currentParameters) return;
    const values: Record<string, string> = {};
    for (const field of allGitFields) {
      const value = getNestedValue(
        currentParameters as Record<string, any>,
        field.path,
      );
      if (value !== undefined && value !== null) {
        values[field.key] = String(value);
      }
    }
    setGitFieldValues(values);
  }, [allGitFields, currentParameters]);

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  const handleGitFieldChange = (key: string, value: string) => {
    setGitFieldValues(prev => ({ ...prev, [key]: value }));
  };

  const handleTrigger = async () => {
    try {
      setError('');

      // Merge all git field values (including hidden ones) back into form data
      const mergedData = JSON.parse(JSON.stringify(formData));
      for (const field of allGitFields) {
        if (gitFieldValues[field.key] !== undefined) {
          setNestedValue(mergedData, field.path, gitFieldValues[field.key]);
        }
      }

      await onTrigger(mergedData);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to trigger workflow',
      );
    }
  };

  const renderGitFields = () => {
    const hasBranch = gitFields.some(f => f.key === 'branch');
    const hasAppPath = gitFields.some(f => f.key === 'appPath');
    const hasCommit = gitFields.some(f => f.key === 'commit');
    const hasSecretRef = gitFields.some(f => f.key === 'secretRef');

    return (
      <Grid container spacing={2}>
        {gitFields.map(field => {
          let sm: 6 | 12 = 12;
          if (
            hasBranch &&
            hasAppPath &&
            (field.key === 'branch' || field.key === 'appPath')
          ) {
            sm = 6;
          }
          if (
            hasCommit &&
            hasSecretRef &&
            (field.key === 'commit' || field.key === 'secretRef')
          ) {
            sm = 6;
          }

          if (field.key === 'secretRef') {
            return (
              <Grid item xs={12} sm={sm} key={field.key}>
                <Autocomplete
                  options={gitSecrets}
                  value={gitFieldValues[field.key] || null}
                  onChange={(_e, value) =>
                    handleGitFieldChange(field.key, value || '')
                  }
                  loading={secretsLoading}
                  disabled={isLoading}
                  renderInput={params => (
                    <TextField
                      {...params}
                      label={field.label}
                      helperText={field.helperText}
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
                  noOptionsText="No git secrets available"
                />
              </Grid>
            );
          }

          return (
            <Grid item xs={12} sm={sm} key={field.key}>
              <TextField
                fullWidth
                label={field.label}
                value={gitFieldValues[field.key] || ''}
                onChange={e => handleGitFieldChange(field.key, e.target.value)}
                helperText={field.helperText}
                variant="outlined"
                disabled={isLoading || !field.editable}
              />
            </Grid>
          );
        })}
      </Grid>
    );
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle disableTypography>
        <Typography variant="h4">Build with Custom Parameters</Typography>
      </DialogTitle>
      <DialogContent className={classes.dialogContent}>
        <Typography variant="body1" className={classes.workflowInfo}>
          Workflow: <strong>{workflowName}</strong>
        </Typography>

        {schemaLoading && (
          <Box className={classes.loadingContainer}>
            <CircularProgress size={24} />
            <Typography variant="body2" color="textSecondary">
              Loading workflow schema...
            </Typography>
          </Box>
        )}

        {schemaError && (
          <Typography className={classes.errorText}>{schemaError}</Typography>
        )}

        {!schemaLoading && schema && (
          <>
            {hasGitFields && (
              <Box className={classes.gitFieldsSection}>
                <Typography className={classes.sectionTitle} variant="h5">
                  Source Configuration
                </Typography>
                {renderGitFields()}
              </Box>
            )}

            {hasRemainingSchemaFields && (
              <Box className={classes.formSection}>
                <Typography className={classes.sectionTitle} variant="h5">
                  Workflow Parameters
                </Typography>
                <Box className={classes.formContainer}>
                  <Form
                    schema={filteredSchema!}
                    formData={formData}
                    onChange={e => setFormData(e.formData)}
                    validator={validator}
                    templates={{
                      ArrayFieldTemplate,
                      DescriptionFieldTemplate,
                      TitleFieldTemplate,
                    }}
                    liveValidate={false}
                    showErrorList={false}
                    noHtml5Validate
                  >
                    <div />
                  </Form>
                </Box>
              </Box>
            )}
          </>
        )}

        {error && (
          <Typography className={classes.errorText}>{error}</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={handleTrigger}
          color="primary"
          variant="contained"
          disabled={isLoading || schemaLoading || !!schemaError || !schema}
          startIcon={isLoading ? <CircularProgress size={16} /> : null}
        >
          {isLoading ? 'Triggering...' : 'Trigger Build'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
