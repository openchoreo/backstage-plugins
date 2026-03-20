import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import type { FieldValidation } from '@rjsf/utils';
import {
  Grid,
  TextField,
  MenuItem,
  CircularProgress,
  InputAdornment,
  Box,
  Typography,
  Button,
  IconButton,
  Divider,
} from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { YamlEditor } from '@openchoreo/backstage-plugin-react';
import { FormYamlToggle } from '@openchoreo/backstage-design-system';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import YAML from 'yaml';
import { useStyles } from './styles';
import {
  NamespaceSelectField,
  type NamespaceOption,
} from '../NamespaceEntityPicker';

interface TargetEnvFormData {
  name: string;
}

interface PromotionPathFormData {
  sourceEnvironmentRef: { name: string };
  targetEnvironmentRefs: TargetEnvFormData[];
}

export interface DeploymentPipelineFormData {
  pipeline_name: string;
  namespace_name: string;
  displayName: string;
  description: string;
  promotionPaths: PromotionPathFormData[];
}

const DEFAULT_FORM_DATA: DeploymentPipelineFormData = {
  pipeline_name: '',
  namespace_name: '',
  displayName: '',
  description: '',
  promotionPaths: [],
};

const DEFAULT_PIPELINE_TEMPLATE = {
  apiVersion: 'openchoreo.dev/v1alpha1',
  kind: 'DeploymentPipeline',
  metadata: {
    name: '',
    namespace: '',
    annotations: {
      'openchoreo.dev/display-name': '',
      'openchoreo.dev/description': '',
    },
  },
  spec: {
    promotionPaths: [] as Array<{
      sourceEnvironmentRef: { kind: string; name: string };
      targetEnvironmentRefs: Array<{
        kind: string;
        name: string;
      }>;
    }>,
  },
};

function extractName(entityRef: string): string {
  const parts = entityRef.split('/');
  return parts[parts.length - 1];
}

function isValidK8sName(name: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name);
}

function formToYaml(formData: DeploymentPipelineFormData): string {
  const template = structuredClone(DEFAULT_PIPELINE_TEMPLATE);
  template.metadata.name = formData.pipeline_name;
  template.metadata.namespace = extractName(formData.namespace_name);
  template.metadata.annotations['openchoreo.dev/display-name'] =
    formData.displayName;
  template.metadata.annotations['openchoreo.dev/description'] =
    formData.description;
  template.spec.promotionPaths = formData.promotionPaths.map(p => ({
    sourceEnvironmentRef: {
      kind: 'Environment',
      name: p.sourceEnvironmentRef.name,
    },
    targetEnvironmentRefs: p.targetEnvironmentRefs.map(t => ({
      kind: 'Environment',
      name: t.name,
    })),
  }));
  return YAML.stringify(template, { indent: 2 });
}

function yamlToForm(
  yamlContent: string,
  namespaces: Array<{ name: string; entityRef: string }>,
): Partial<DeploymentPipelineFormData> {
  const parsed = YAML.parse(yamlContent);
  if (!parsed || typeof parsed !== 'object') return {};

  const namespaceName = parsed.metadata?.namespace || '';
  const matchedNamespace = namespaces.find(
    ns => extractName(ns.entityRef) === namespaceName,
  );

  return {
    pipeline_name: parsed.metadata?.name || '',
    namespace_name: matchedNamespace?.entityRef || '',
    displayName:
      parsed.metadata?.annotations?.['openchoreo.dev/display-name'] || '',
    description:
      parsed.metadata?.annotations?.['openchoreo.dev/description'] || '',
    promotionPaths: (parsed.spec?.promotionPaths || []).map(
      (p: {
        sourceEnvironmentRef?: string | { name?: string };
        targetEnvironmentRefs?: Array<{
          name?: string;
        }>;
      }) => ({
        sourceEnvironmentRef: {
          name:
            typeof p.sourceEnvironmentRef === 'string'
              ? p.sourceEnvironmentRef
              : p.sourceEnvironmentRef?.name || '',
        },
        targetEnvironmentRefs: (p.targetEnvironmentRefs || []).map(
          (t: { name?: string }) => ({
            name: t.name || '',
          }),
        ),
      }),
    ),
  };
}

interface PromotionPathRowProps {
  path: PromotionPathFormData;
  index: number;
  environments: Array<{ name: string; entityRef: string }>;
  onUpdate: (index: number, path: PromotionPathFormData) => void;
  onRemove: (index: number) => void;
  classes: ReturnType<typeof useStyles>;
}

function PromotionPathRow({
  path,
  index,
  environments,
  onUpdate,
  onRemove,
  classes,
}: PromotionPathRowProps) {
  const updateSource = (name: string) => {
    onUpdate(index, {
      ...path,
      sourceEnvironmentRef: { name },
    });
  };

  const addTarget = () => {
    onUpdate(index, {
      ...path,
      targetEnvironmentRefs: [...path.targetEnvironmentRefs, { name: '' }],
    });
  };

  const removeTarget = (targetIndex: number) => {
    const targets = [...path.targetEnvironmentRefs];
    targets.splice(targetIndex, 1);
    onUpdate(index, { ...path, targetEnvironmentRefs: targets });
  };

  const updateTarget = (
    targetIndex: number,
    field: keyof TargetEnvFormData,
    value: string,
  ) => {
    const targets = [...path.targetEnvironmentRefs];
    targets[targetIndex] = { ...targets[targetIndex], [field]: value };
    onUpdate(index, { ...path, targetEnvironmentRefs: targets });
  };

  return (
    <div className={classes.promotionPathCard}>
      <div className={classes.promotionPathHeader}>
        <Typography variant="subtitle2">Promotion Path {index + 1}</Typography>
        <IconButton
          size="small"
          className={classes.removeButton}
          onClick={() => onRemove(index)}
          aria-label="Remove promotion path"
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </div>

      {/* Source Environment */}
      <TextField
        select
        label="Source Environment"
        value={path.sourceEnvironmentRef.name}
        onChange={e => updateSource(e.target.value)}
        fullWidth
        variant="outlined"
        size="small"
        helperText="Environment where promotion starts"
      >
        {environments.map(env => (
          <MenuItem key={env.name} value={env.name}>
            {env.name}
          </MenuItem>
        ))}
      </TextField>

      {/* Target Environments */}
      <Box mt={2}>
        <Typography variant="body2" color="textSecondary">
          Target Environments
        </Typography>
        {path.targetEnvironmentRefs.map((target, tIdx) => (
          <div key={tIdx} className={classes.targetRow}>
            <TextField
              select
              label="Target Environment"
              value={target.name}
              onChange={e => updateTarget(tIdx, 'name', e.target.value)}
              variant="outlined"
              size="small"
              style={{ flex: 1 }}
            >
              {environments.map(env => (
                <MenuItem key={env.name} value={env.name}>
                  {env.name}
                </MenuItem>
              ))}
            </TextField>
            <IconButton
              size="small"
              className={classes.removeButton}
              onClick={() => removeTarget(tIdx)}
              aria-label="Remove target environment"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </div>
        ))}
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={addTarget}
          className={classes.addButton}
        >
          Add Target Environment
        </Button>
      </Box>
    </div>
  );
}

export const DeploymentPipelineFormWithYamlExtension = ({
  onChange,
  formData,
  rawErrors,
}: FieldExtensionComponentProps<DeploymentPipelineFormData>) => {
  const classes = useStyles();
  const catalogApi = useApi(catalogApiRef);

  const [mode, setMode] = useState<'form' | 'yaml'>('form');
  const [yamlContent, setYamlContent] = useState('');
  const [yamlError, setYamlError] = useState<string | undefined>();

  const [namespaces, setNamespaces] = useState<NamespaceOption[]>([]);
  const [environments, setEnvironments] = useState<
    Array<{ name: string; entityRef: string }>
  >([]);

  const initializedRef = useRef(false);
  const nsPreselectedRef = useRef(false);
  const formDataRef = useRef(formData);

  const [pipelineNameDuplicateError, setPipelineNameDuplicateError] = useState<
    string | null
  >(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  const data: DeploymentPipelineFormData = useMemo(
    () => ({ ...DEFAULT_FORM_DATA, ...formData }),
    [formData],
  );

  useEffect(() => {
    formDataRef.current = formData;
  });

  // Fetch environments filtered by selected namespace
  useEffect(() => {
    const nsName = data.namespace_name ? extractName(data.namespace_name) : '';
    if (!nsName) {
      setEnvironments([]);
      return;
    }

    const fetchEnvs = async () => {
      try {
        const { items } = await catalogApi.getEntities({
          filter: { kind: 'Environment' },
        });
        const filtered = items.filter(
          e =>
            e.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] === nsName &&
            !e.metadata.annotations?.[CHOREO_ANNOTATIONS.DELETION_TIMESTAMP],
        );
        setEnvironments(
          filtered.map(e => ({
            name: e.metadata.name,
            entityRef: `environment:${e.metadata.namespace || 'default'}/${
              e.metadata.name
            }`,
          })),
        );
      } catch {
        setEnvironments([]);
      }
    };
    fetchEnvs();
  }, [data.namespace_name, catalogApi]);

  // Initialize form data on mount if empty
  useEffect(() => {
    if (!initializedRef.current && !formData) {
      initializedRef.current = true;
      onChange(DEFAULT_FORM_DATA);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced duplicate check for pipeline name
  useEffect(() => {
    const name = data.pipeline_name;
    const nsRef = data.namespace_name;
    const nsName = nsRef ? extractName(nsRef) : '';

    if (!name || !isValidK8sName(name) || !nsName) {
      setPipelineNameDuplicateError(null);
      setCheckingDuplicate(false);
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      return () => {};
    }

    setCheckingDuplicate(true);

    const timeoutId = setTimeout(async () => {
      try {
        const { items } = await catalogApi.getEntities({
          filter: { kind: 'DeploymentPipeline' },
        });
        const exists = items.some(
          entity =>
            entity.metadata.name === name &&
            entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ===
              nsName &&
            !entity.metadata.annotations?.[
              CHOREO_ANNOTATIONS.DELETION_TIMESTAMP
            ],
        );
        if (exists) {
          setPipelineNameDuplicateError(
            `A deployment pipeline named "${name}" already exists in namespace "${nsName}"`,
          );
        } else {
          setPipelineNameDuplicateError(null);
        }
      } catch {
        setPipelineNameDuplicateError(null);
      } finally {
        setCheckingDuplicate(false);
      }
    }, 500);

    return () => {
      clearTimeout(timeoutId);
      setCheckingDuplicate(false);
    };
  }, [data.pipeline_name, data.namespace_name, catalogApi]);

  const updateField = useCallback(
    (field: keyof DeploymentPipelineFormData, value: string | boolean) => {
      const updated = { ...data, [field]: value };
      onChange(updated);
    },
    [data, onChange],
  );

  const updatePromotionPath = useCallback(
    (index: number, path: PromotionPathFormData) => {
      const paths = [...data.promotionPaths];
      paths[index] = path;
      onChange({ ...data, promotionPaths: paths });
    },
    [data, onChange],
  );

  const addPromotionPath = useCallback(() => {
    onChange({
      ...data,
      promotionPaths: [
        ...data.promotionPaths,
        {
          sourceEnvironmentRef: { name: '' },
          targetEnvironmentRefs: [{ name: '' }],
        },
      ],
    });
  }, [data, onChange]);

  const removePromotionPath = useCallback(
    (index: number) => {
      const paths = [...data.promotionPaths];
      paths.splice(index, 1);
      onChange({ ...data, promotionPaths: paths });
    },
    [data, onChange],
  );

  const handleModeChange = useCallback(
    (newMode: 'form' | 'yaml') => {
      if (newMode === mode) return;

      if (newMode === 'yaml') {
        setYamlContent(formToYaml(data));
        setYamlError(undefined);
      } else {
        try {
          const parsed = yamlToForm(yamlContent, namespaces);
          onChange({ ...data, ...parsed });
          setYamlError(undefined);
        } catch (err) {
          setYamlError(`Failed to parse YAML: ${err}`);
          return;
        }
      }
      setMode(newMode);
    },
    [mode, data, yamlContent, namespaces, onChange],
  );

  const handleYamlChange = useCallback(
    (content: string) => {
      setYamlContent(content);
      try {
        YAML.parse(content);
        setYamlError(undefined);
        const parsed = yamlToForm(content, namespaces);
        onChange({ ...data, ...parsed });
      } catch (err) {
        setYamlError(`YAML parse error: ${err}`);
      }
    },
    [namespaces, data, onChange],
  );

  return (
    <div>
      {/* Toggle */}
      <div className={classes.toggleContainer}>
        <FormYamlToggle value={mode} onChange={handleModeChange} />
      </div>

      {mode === 'form' ? (
        <div className={classes.formContainer}>
          <Grid container spacing={2}>
            {/* Namespace */}
            <Grid item xs={12} sm={6}>
              <NamespaceSelectField
                value={data.namespace_name}
                onChange={v => updateField('namespace_name', v)}
                label="Namespace"
                helperText="Namespace where the deployment pipeline will be created"
                required
                onNamespacesLoaded={ns => {
                  setNamespaces(ns);
                  if (!nsPreselectedRef.current && ns.length > 0) {
                    const current = formDataRef.current;
                    if (!current?.namespace_name) {
                      nsPreselectedRef.current = true;
                      const defaultNs = ns.find(n => n.name === 'default');
                      onChange({
                        ...DEFAULT_FORM_DATA,
                        ...current,
                        namespace_name: (defaultNs ?? ns[0]).entityRef,
                      });
                    }
                  }
                }}
              />
            </Grid>

            {/* Pipeline Name */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Pipeline Name"
                value={data.pipeline_name}
                onChange={e => updateField('pipeline_name', e.target.value)}
                fullWidth
                variant="outlined"
                required
                error={
                  (!!data.pipeline_name &&
                    !isValidK8sName(data.pipeline_name)) ||
                  !!pipelineNameDuplicateError
                }
                helperText={
                  data.pipeline_name && !isValidK8sName(data.pipeline_name)
                    ? 'Must be lowercase alphanumeric with hyphens, starting and ending with alphanumeric'
                    : pipelineNameDuplicateError ||
                      'Unique name for your deployment pipeline (must be a valid Kubernetes name)'
                }
                InputProps={{
                  endAdornment: checkingDuplicate ? (
                    <InputAdornment position="end">
                      <CircularProgress size={20} />
                    </InputAdornment>
                  ) : undefined,
                }}
              />
            </Grid>

            {/* Display Name */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Display Name"
                value={data.displayName}
                onChange={e => updateField('displayName', e.target.value)}
                fullWidth
                variant="outlined"
                helperText="A human-readable display name for the deployment pipeline"
              />
            </Grid>

            {/* Description */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Description"
                value={data.description}
                onChange={e => updateField('description', e.target.value)}
                fullWidth
                variant="outlined"
                helperText="Describe what this deployment pipeline is for"
              />
            </Grid>
          </Grid>

          {/* Promotion Paths */}
          <div className={classes.promotionPathsSection}>
            <Divider style={{ marginBottom: 16 }} />
            <Typography variant="subtitle2" gutterBottom>
              Promotion Paths
            </Typography>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Define how releases flow between environments. Each promotion path
              specifies a source environment and one or more target environments
              it can promote to.
            </Typography>

            {data.promotionPaths.map((path, idx) => (
              <PromotionPathRow
                key={idx}
                path={path}
                index={idx}
                environments={environments}
                onUpdate={updatePromotionPath}
                onRemove={removePromotionPath}
                classes={classes}
              />
            ))}

            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={addPromotionPath}
              className={classes.addButton}
            >
              Add Promotion Path
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <div className={classes.helpText}>
            <span>
              Edit the DeploymentPipeline CR YAML directly. For available fields
              and configuration options, see the{' '}
              <a
                className={classes.helpLink}
                href="https://openchoreo.dev/docs/reference/api/platform/deployment-pipeline/"
                target="_blank"
                rel="noopener noreferrer"
              >
                DeploymentPipeline documentation
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

export const DeploymentPipelineFormWithYamlSchema = {
  returnValue: {
    type: 'object' as const,
    properties: {
      pipeline_name: { type: 'string' as const },
      namespace_name: { type: 'string' as const },
      displayName: { type: 'string' as const },
      description: { type: 'string' as const },
      promotionPaths: { type: 'array' as const },
    },
  },
};

export const deploymentPipelineFormWithYamlValidation = (
  value: DeploymentPipelineFormData,
  validation: FieldValidation,
) => {
  if (!value?.pipeline_name || value.pipeline_name.trim() === '') {
    validation.addError('Pipeline name is required');
  } else if (!isValidK8sName(value.pipeline_name)) {
    validation.addError(
      'Pipeline name must be lowercase alphanumeric with hyphens, starting and ending with alphanumeric',
    );
  }
  if (!value?.namespace_name || value.namespace_name.trim() === '') {
    validation.addError('Namespace is required');
  }
};
