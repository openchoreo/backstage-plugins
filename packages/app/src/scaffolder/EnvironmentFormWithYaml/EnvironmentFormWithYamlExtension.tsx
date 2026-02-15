import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import type { FieldValidation } from '@rjsf/utils';
import {
  Grid,
  TextField,
  MenuItem,
  CircularProgress,
  InputAdornment,
  Switch,
  Box,
  Typography,
} from '@material-ui/core';
import { ToggleButton, ToggleButtonGroup } from '@material-ui/lab';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { YamlEditor } from '@openchoreo/backstage-plugin-react';
import YAML from 'yaml';
import { useStyles } from './styles';

export interface EnvironmentFormData {
  environment_name: string;
  namespace_name: string;
  displayName: string;
  description: string;
  dataPlaneRef: string;
  isProduction: boolean;
}

const DEFAULT_FORM_DATA: EnvironmentFormData = {
  environment_name: '',
  namespace_name: '',
  displayName: '',
  description: '',
  dataPlaneRef: '',
  isProduction: false,
};

const DEFAULT_ENVIRONMENT_TEMPLATE = {
  apiVersion: 'openchoreo.dev/v1alpha1',
  kind: 'Environment',
  metadata: {
    name: '',
    namespace: '',
    annotations: {
      'openchoreo.dev/display-name': '',
      'openchoreo.dev/description': '',
    },
  },
  spec: {
    dataPlaneRef: '',
    isProduction: false,
  },
};

/** Extract the last segment from an entity reference (e.g., "domain:default/name" -> "name") */
function extractName(entityRef: string): string {
  const parts = entityRef.split('/');
  return parts[parts.length - 1];
}

function formToYaml(data: EnvironmentFormData): string {
  const template = structuredClone(DEFAULT_ENVIRONMENT_TEMPLATE);
  template.metadata.name = data.environment_name;
  template.metadata.namespace = extractName(data.namespace_name);
  template.metadata.annotations['openchoreo.dev/display-name'] =
    data.displayName;
  template.metadata.annotations['openchoreo.dev/description'] =
    data.description;
  template.spec.dataPlaneRef = extractName(data.dataPlaneRef);
  template.spec.isProduction = data.isProduction;
  return YAML.stringify(template, { indent: 2 });
}

function yamlToForm(
  yamlContent: string,
  namespaces: Array<{ name: string; entityRef: string }>,
  dataplanes: Array<{ name: string; entityRef: string }>,
): Partial<EnvironmentFormData> {
  const parsed = YAML.parse(yamlContent);
  if (!parsed || typeof parsed !== 'object') return {};

  const namespaceName = parsed.metadata?.namespace || '';
  const dataPlaneRef = parsed.spec?.dataPlaneRef || '';

  // Try to match back to entity refs
  const matchedNamespace = namespaces.find(
    ns => extractName(ns.entityRef) === namespaceName,
  );
  const matchedDataplane = dataplanes.find(
    dp => extractName(dp.entityRef) === dataPlaneRef,
  );

  return {
    environment_name: parsed.metadata?.name || '',
    namespace_name: matchedNamespace?.entityRef || '',
    displayName:
      parsed.metadata?.annotations?.['openchoreo.dev/display-name'] || '',
    description:
      parsed.metadata?.annotations?.['openchoreo.dev/description'] || '',
    dataPlaneRef: matchedDataplane?.entityRef || '',
    isProduction: parsed.spec?.isProduction ?? false,
  };
}

/** Kubernetes name validation: lowercase alphanumeric and hyphens, must start/end with alphanumeric */
function isValidK8sName(name: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name);
}

export const EnvironmentFormWithYamlExtension = ({
  onChange,
  formData,
  rawErrors,
}: FieldExtensionComponentProps<EnvironmentFormData>) => {
  const classes = useStyles();
  const catalogApi = useApi(catalogApiRef);

  const [mode, setMode] = useState<'form' | 'yaml'>('form');
  const [yamlContent, setYamlContent] = useState('');
  const [yamlError, setYamlError] = useState<string | undefined>();

  const [namespaces, setNamespaces] = useState<
    Array<{ name: string; entityRef: string }>
  >([]);
  const [dataplanes, setDataplanes] = useState<
    Array<{ name: string; entityRef: string }>
  >([]);
  const [loadingNamespaces, setLoadingNamespaces] = useState(true);
  const [loadingDataplanes, setLoadingDataplanes] = useState(true);

  const initializedRef = useRef(false);

  // Current form values - wrapped in useMemo to maintain stable reference
  const data: EnvironmentFormData = useMemo(
    () => ({ ...DEFAULT_FORM_DATA, ...formData }),
    [formData],
  );

  // Fetch Domain entities for namespace dropdown
  useEffect(() => {
    const fetchNamespaces = async () => {
      try {
        const { items } = await catalogApi.getEntities({
          filter: { kind: 'Domain' },
        });
        const list = items.map(entity => ({
          name: entity.metadata.name,
          entityRef: `domain:${entity.metadata.namespace || 'default'}/${
            entity.metadata.name
          }`,
        }));
        setNamespaces(list);

        // Auto-select first namespace if none set
        if (list.length > 0 && !formData?.namespace_name) {
          onChange({ ...data, namespace_name: list[0].entityRef });
        }
      } catch {
        // ignore fetch errors
      } finally {
        setLoadingNamespaces(false);
      }
    };
    fetchNamespaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch Dataplane entities
  useEffect(() => {
    const fetchDataplanes = async () => {
      try {
        const { items } = await catalogApi.getEntities({
          filter: { kind: 'Dataplane' },
        });
        const list = items.map(entity => ({
          name: entity.metadata.name,
          entityRef: `dataplane:${entity.metadata.namespace || 'default'}/${
            entity.metadata.name
          }`,
        }));
        setDataplanes(list);

        // Auto-select first dataplane if none set
        if (list.length > 0 && !formData?.dataPlaneRef) {
          onChange({ ...data, dataPlaneRef: list[0].entityRef });
        }
      } catch {
        // ignore fetch errors
      } finally {
        setLoadingDataplanes(false);
      }
    };
    fetchDataplanes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize form data on mount if empty
  useEffect(() => {
    if (!initializedRef.current && !formData) {
      initializedRef.current = true;
      onChange(DEFAULT_FORM_DATA);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateField = useCallback(
    (field: keyof EnvironmentFormData, value: string | boolean) => {
      const updated = { ...data, [field]: value };
      onChange(updated);
    },
    [data, onChange],
  );

  const handleModeChange = useCallback(
    (_: unknown, newMode: 'form' | 'yaml' | null) => {
      if (!newMode || newMode === mode) return;

      if (newMode === 'yaml') {
        // Form -> YAML: generate YAML from current form values
        setYamlContent(formToYaml(data));
        setYamlError(undefined);
      } else {
        // YAML -> Form: parse YAML and update form
        try {
          const parsed = yamlToForm(yamlContent, namespaces, dataplanes);
          onChange({ ...data, ...parsed });
          setYamlError(undefined);
        } catch (err) {
          setYamlError(`Failed to parse YAML: ${err}`);
          return; // Don't switch if YAML is invalid
        }
      }
      setMode(newMode);
    },
    [mode, data, yamlContent, namespaces, dataplanes, onChange],
  );

  const handleYamlChange = useCallback(
    (content: string) => {
      setYamlContent(content);
      try {
        YAML.parse(content);
        setYamlError(undefined);
        // Parse and update form data so submission always has current values
        const parsed = yamlToForm(content, namespaces, dataplanes);
        onChange({ ...data, ...parsed });
      } catch (err) {
        setYamlError(`YAML parse error: ${err}`);
      }
    },
    [namespaces, dataplanes, data, onChange],
  );

  return (
    <div>
      {/* Toggle */}
      <div className={classes.toggleContainer}>
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={handleModeChange}
          size="small"
        >
          <ToggleButton value="form" className={classes.toggleButton}>
            Form
          </ToggleButton>
          <ToggleButton value="yaml" className={classes.toggleButton}>
            YAML
          </ToggleButton>
        </ToggleButtonGroup>
      </div>

      {mode === 'form' ? (
        <div className={classes.formContainer}>
          <Grid container spacing={2}>
            {/* Environment Name */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Environment Name"
                value={data.environment_name}
                onChange={e => updateField('environment_name', e.target.value)}
                fullWidth
                variant="outlined"
                required
                error={
                  !!data.environment_name &&
                  !isValidK8sName(data.environment_name)
                }
                helperText={
                  data.environment_name &&
                  !isValidK8sName(data.environment_name)
                    ? 'Must be lowercase alphanumeric with hyphens, starting and ending with alphanumeric'
                    : 'Name of the environment (must be a valid Kubernetes name)'
                }
              />
            </Grid>

            {/* Namespace */}
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Namespace"
                value={data.namespace_name}
                onChange={e => updateField('namespace_name', e.target.value)}
                fullWidth
                variant="outlined"
                required
                disabled={loadingNamespaces}
                helperText="Namespace where the environment will be created"
                InputProps={{
                  endAdornment: loadingNamespaces ? (
                    <InputAdornment position="end">
                      <CircularProgress size={20} />
                    </InputAdornment>
                  ) : undefined,
                }}
              >
                {namespaces.map(ns => (
                  <MenuItem key={ns.entityRef} value={ns.entityRef}>
                    {ns.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Data Plane */}
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Data Plane"
                value={data.dataPlaneRef}
                onChange={e => updateField('dataPlaneRef', e.target.value)}
                fullWidth
                variant="outlined"
                required
                disabled={loadingDataplanes}
                helperText="Select the data plane cluster for workloads in this environment"
                InputProps={{
                  endAdornment: loadingDataplanes ? (
                    <InputAdornment position="end">
                      <CircularProgress size={20} />
                    </InputAdornment>
                  ) : undefined,
                }}
              >
                {dataplanes.map(dp => (
                  <MenuItem key={dp.entityRef} value={dp.entityRef}>
                    {dp.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Display Name */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Display Name"
                value={data.displayName}
                onChange={e => updateField('displayName', e.target.value)}
                fullWidth
                variant="outlined"
                helperText="A human-readable display name for the environment"
              />
            </Grid>

            {/* Description */}
            <Grid item xs={12}>
              <TextField
                label="Description"
                value={data.description}
                onChange={e => updateField('description', e.target.value)}
                fullWidth
                variant="outlined"
                helperText="Describe what this environment is for (e.g., Development, Staging, Production)"
              />
            </Grid>

            {/* Production Switch */}
            <Grid item xs={12}>
              <Box display="flex" alignItems="center">
                <Box style={{ marginRight: 16 }}>
                  <Typography variant="body1">
                    Production Environment
                  </Typography>
                </Box>
                <Switch
                  checked={data.isProduction}
                  onChange={e => updateField('isProduction', e.target.checked)}
                  color="primary"
                />
              </Box>
              <Typography variant="body2" color="textSecondary">
                Mark this as a production environment.
              </Typography>
            </Grid>
          </Grid>
        </div>
      ) : (
        <div>
          <div className={classes.helpText}>
            <span>
              Edit the Environment CR YAML directly. For available fields and
              configuration options, see the{' '}
              <a
                className={classes.helpLink}
                href="https://openchoreo.dev/docs/reference/api/platform/environment/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Environment documentation
              </a>
              .
            </span>
          </div>
          <div className={classes.yamlContainer}>
            <YamlEditor
              content={yamlContent}
              onChange={handleYamlChange}
              errorText={yamlError}
            />
          </div>
        </div>
      )}

      {rawErrors && rawErrors.length > 0 && (
        <div className={classes.errorText}>{rawErrors.join(', ')}</div>
      )}
    </div>
  );
};

export const EnvironmentFormWithYamlSchema = {
  returnValue: {
    type: 'object' as const,
    properties: {
      environment_name: { type: 'string' as const },
      namespace_name: { type: 'string' as const },
      displayName: { type: 'string' as const },
      description: { type: 'string' as const },
      dataPlaneRef: { type: 'string' as const },
      isProduction: { type: 'boolean' as const },
    },
  },
};

export const environmentFormWithYamlValidation = (
  value: EnvironmentFormData,
  validation: FieldValidation,
) => {
  if (!value?.environment_name || value.environment_name.trim() === '') {
    validation.addError('Environment name is required');
  } else if (!isValidK8sName(value.environment_name)) {
    validation.addError(
      'Environment name must be lowercase alphanumeric with hyphens, starting and ending with alphanumeric',
    );
  }
  if (!value?.namespace_name || value.namespace_name.trim() === '') {
    validation.addError('Namespace is required');
  }
  if (!value?.dataPlaneRef || value.dataPlaneRef.trim() === '') {
    validation.addError('Data Plane is required');
  }
};
