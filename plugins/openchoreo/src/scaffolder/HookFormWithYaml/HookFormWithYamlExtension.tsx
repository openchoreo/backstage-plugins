import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import type { FieldValidation } from '@rjsf/utils';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Collapse,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import HelpOutlineIcon from '@material-ui/icons/HelpOutline';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
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
import {
  DEFAULT_FORM_DATA,
  DEPLOYMENT_CONTEXT_PATHS,
  K8S_NAME_PATTERN,
  PARAMETER_NAME_PATTERN,
  PARAMETER_SOURCE_LABELS,
  extractName,
  formToYaml,
  summarizeWorkflowSchema,
  unmappedRequiredInputs,
  validateHookForm,
  yamlToForm,
  type HookEnabledToFormRow,
  type HookFormData,
  type HookParameterFormRow,
  type HookParameterSourceOption,
  type HookScope,
  type WorkflowSchemaSummary,
} from './hookForm';

interface Option {
  name: string;
  kind: string;
}

interface HookFormProps extends FieldExtensionComponentProps<HookFormData> {
  scope: HookScope;
}

const SOURCE_OPTIONS: HookParameterSourceOption[] = [
  'value',
  'from',
  'default',
  'required',
];

const VALUE_LABELS: Record<HookParameterSourceOption, string> = {
  value: 'Value',
  from: 'Expression',
  default: 'Default value',
  required: '',
};

const SOURCE_HELP: Record<HookParameterSourceOption, string> = {
  value: 'Literal the hook always sends; a binding cannot change it',
  from: '',
  default: 'Used unless the pipeline binding supplies a value',
  required: 'Every pipeline binding must supply a value',
};

interface ParameterRowProps {
  row: HookParameterFormRow;
  index: number;
  schemaProperties: string[];
  onUpdate: (index: number, row: HookParameterFormRow) => void;
  onRemove: (index: number) => void;
  classes: ReturnType<typeof useStyles>;
  /** Mark empty or duplicate fields; on once the user has tried to review. */
  showErrors?: boolean;
  /** Another row already uses this name. */
  duplicate?: boolean;
}

function ParameterRow({
  row,
  index,
  schemaProperties,
  onUpdate,
  onRemove,
  classes,
  showErrors = false,
  duplicate = false,
}: ParameterRowProps) {
  const nameMissing = showErrors && !row.name.trim();
  const nameDuplicate = showErrors && !!row.name && duplicate;
  const nameInvalid = !!row.name && !PARAMETER_NAME_PATTERN.test(row.name);
  const fromMissing = showErrors && row.source === 'from' && !row.value.trim();
  const fromInvalid =
    row.source === 'from' && !!row.value && !/\$\{[^}]+\}/.test(row.value);
  const nameKnown = schemaProperties.includes(row.name);
  let nameHelperText = ' ';
  if (nameMissing) {
    nameHelperText = 'Name is required';
  } else if (nameDuplicate) {
    nameHelperText = 'Another parameter already uses this name';
  } else if (nameInvalid) {
    nameHelperText = 'Letters, digits, _ or -; must start with a letter';
  } else if (schemaProperties.length > 0 && !nameKnown && row.name) {
    nameHelperText = 'Not in the workflow schema';
  }

  return (
    <div className={classes.parameterCard} data-testid="hook-parameter-row">
      <Grid container spacing={1} alignItems="flex-start">
        <Grid item xs={12} sm={4}>
          <TextField
            label="Input name"
            value={row.name}
            onChange={e => onUpdate(index, { ...row, name: e.target.value })}
            fullWidth
            variant="outlined"
            size="small"
            select={schemaProperties.length > 0 && nameKnown}
            error={nameMissing || nameDuplicate || nameInvalid}
            helperText={nameHelperText}
            inputProps={{ 'aria-label': `Parameter ${index + 1} name` }}
          >
            {schemaProperties.map(p => (
              <MenuItem key={p} value={p}>
                {p}
              </MenuItem>
            ))}
          </TextField>
          {schemaProperties.length > 0 && !nameKnown && (
            <Box display="flex" flexWrap="wrap" style={{ gap: 4 }}>
              {schemaProperties.slice(0, 8).map(p => (
                <Chip
                  key={p}
                  size="small"
                  label={p}
                  onClick={() => onUpdate(index, { ...row, name: p })}
                />
              ))}
            </Box>
          )}
        </Grid>
        <Grid item xs={12} sm={3}>
          <TextField
            select
            label="Source"
            value={row.source}
            onChange={e =>
              onUpdate(index, {
                ...row,
                source: e.target.value as HookParameterSourceOption,
                overridable:
                  e.target.value === 'from' ? row.overridable : false,
              })
            }
            fullWidth
            variant="outlined"
            size="small"
            helperText={SOURCE_HELP[row.source]}
          >
            {SOURCE_OPTIONS.map(s => (
              <MenuItem key={s} value={s}>
                {PARAMETER_SOURCE_LABELS[s]}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={4}>
          {row.source !== 'required' && (
            <TextField
              label={VALUE_LABELS[row.source]}
              value={row.value}
              onChange={e => onUpdate(index, { ...row, value: e.target.value })}
              fullWidth
              variant="outlined"
              size="small"
              error={fromMissing || fromInvalid}
              // No reserved blank line, so the checkbox sits right below.
              helperText={
                (fromMissing && 'Expression is required') ||
                (fromInvalid && 'Must contain a ${…} expression') ||
                undefined
              }
              inputProps={{ 'aria-label': `Parameter ${index + 1} value` }}
            />
          )}
          {row.source === 'from' && (
            <FormControlLabel
              className={classes.overridableLabel}
              control={
                <Checkbox
                  size="small"
                  className={classes.overridableCheckbox}
                  checked={row.overridable}
                  onChange={e =>
                    onUpdate(index, { ...row, overridable: e.target.checked })
                  }
                />
              }
              label="Overridable by a binding"
            />
          )}
        </Grid>
        <Grid item xs={12} sm={1}>
          <IconButton
            size="small"
            className={classes.removeButton}
            onClick={() => onRemove(index)}
            aria-label={`Remove parameter ${index + 1}`}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Grid>
      </Grid>
    </div>
  );
}

function HookFormWithYaml({
  scope,
  onChange,
  formData,
  rawErrors,
}: HookFormProps) {
  const classes = useStyles();
  const catalogApi = useApi(catalogApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const isCluster = scope === 'cluster';
  const [mode, setMode] = useState<'form' | 'yaml'>('form');
  const [yamlContent, setYamlContent] = useState('');
  const [yamlError, setYamlError] = useState<string | undefined>();
  const [showPaths, setShowPaths] = useState(false);

  const [namespaces, setNamespaces] = useState<NamespaceOption[]>([]);
  const [workflows, setWorkflows] = useState<Option[]>([]);
  const [componentTypes, setComponentTypes] = useState<Option[]>([]);
  const [schema, setSchema] = useState<WorkflowSchemaSummary | undefined>();
  const [schemaError, setSchemaError] = useState<string | undefined>();
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const initializedRef = useRef(false);
  const nsPreselectedRef = useRef(false);
  const formDataRef = useRef(formData);

  const data: HookFormData = useMemo(
    () => ({
      ...DEFAULT_FORM_DATA,
      workflowKind: isCluster
        ? 'ClusterWorkflow'
        : DEFAULT_FORM_DATA.workflowKind,
      ...formData,
    }),
    [formData, isCluster],
  );

  useEffect(() => {
    formDataRef.current = formData;
  });

  const emit = useCallback(
    (next: HookFormData) => {
      onChange({ ...next, yamlContent: formToYaml(next, scope) });
    },
    [onChange, scope],
  );

  // Initialize on mount so the YAML is present even before any edit.
  useEffect(() => {
    if (!initializedRef.current && !formData) {
      initializedRef.current = true;
      emit({
        ...DEFAULT_FORM_DATA,
        workflowKind: isCluster ? 'ClusterWorkflow' : 'ClusterWorkflow',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nsName =
    !isCluster && data.namespace_name ? extractName(data.namespace_name) : '';

  // Workflows: ClusterWorkflows always; namespaced Workflows for a Hook.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { items } = await catalogApi.getEntities({
          filter: isCluster
            ? { kind: 'ClusterWorkflow' }
            : [{ kind: 'ClusterWorkflow' }, { kind: 'Workflow' }],
        });
        const opts: Option[] = items
          .filter(e => {
            if (e.metadata.annotations?.[CHOREO_ANNOTATIONS.DELETION_TIMESTAMP])
              return false;
            // Build (component CI) workflows take a component's source and
            // produce an image; a hook runs against a release that already
            // exists, so they are never valid here. The translator marks them
            // spec.type 'CI' (from the openchoreo.dev/workflow-type label).
            if ((e.spec as { type?: string } | undefined)?.type === 'CI')
              return false;
            if (e.kind === 'Workflow') {
              return (
                !!nsName &&
                e.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ===
                  nsName
              );
            }
            return true;
          })
          .map(e => ({ name: e.metadata.name, kind: e.kind }))
          .sort(
            (a, b) =>
              a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name),
          );
        if (!cancelled) setWorkflows(opts);
      } catch {
        if (!cancelled) setWorkflows([]);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [catalogApi, isCluster, nsName]);

  // Component types for `enabledTo`.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { items } = await catalogApi.getEntities({
          filter: [{ kind: 'ClusterComponentType' }, { kind: 'ComponentType' }],
        });
        const opts: Option[] = items
          .filter(e => {
            if (e.metadata.annotations?.[CHOREO_ANNOTATIONS.DELETION_TIMESTAMP])
              return false;
            if (e.kind === 'ComponentType') {
              return (
                !!nsName &&
                e.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ===
                  nsName
              );
            }
            return true;
          })
          .map(e => ({ name: e.metadata.name, kind: e.kind }));
        if (!cancelled) setComponentTypes(opts);
      } catch {
        if (!cancelled) setComponentTypes([]);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [catalogApi, nsName]);

  // Workflow schema: seeds the parameter rows and flags unmapped required inputs.
  useEffect(() => {
    let cancelled = false;
    if (!data.workflowName) {
      setSchema(undefined);
      setSchemaError(undefined);
      return undefined;
    }
    const load = async () => {
      try {
        const kind = isCluster ? 'ClusterWorkflow' : data.workflowKind;
        const backendId =
          kind === 'ClusterWorkflow'
            ? 'openchoreo-ci-backend'
            : 'openchoreo-workflows-backend';
        const baseUrl = await discoveryApi.getBaseUrl(backendId);
        const url =
          kind === 'ClusterWorkflow'
            ? `${baseUrl}/cluster-workflow-schema?workflowName=${encodeURIComponent(
                data.workflowName,
              )}`
            : `${baseUrl}/workflows/${encodeURIComponent(
                data.workflowName,
              )}/schema?namespaceName=${encodeURIComponent(nsName)}`;
        const response = await fetchApi.fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const body = await response.json();
        if (!cancelled) {
          setSchema(summarizeWorkflowSchema(body));
          setSchemaError(undefined);
        }
      } catch (err) {
        if (!cancelled) {
          setSchema(undefined);
          setSchemaError(
            `Could not load the workflow's parameter schema: ${err}`,
          );
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [
    data.workflowName,
    data.workflowKind,
    isCluster,
    nsName,
    discoveryApi,
    fetchApi,
  ]);

  // Debounced duplicate-name check against the catalog.
  useEffect(() => {
    const name = data.hook_name;
    if (!name || !K8S_NAME_PATTERN.test(name) || (!isCluster && !nsName)) {
      setDuplicateError(null);
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      return () => {};
    }
    const timeoutId = setTimeout(async () => {
      try {
        const { items } = await catalogApi.getEntities({
          filter: { kind: isCluster ? 'ClusterHook' : 'Hook' },
        });
        const exists = items.some(
          e =>
            e.metadata.name === name &&
            (isCluster ||
              e.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ===
                nsName) &&
            !e.metadata.annotations?.[CHOREO_ANNOTATIONS.DELETION_TIMESTAMP],
        );
        setDuplicateError(
          exists
            ? `A ${
                isCluster ? 'cluster hook' : 'hook'
              } named "${name}" already exists${
                isCluster ? '' : ` in namespace "${nsName}"`
              }`
            : null,
        );
      } catch {
        setDuplicateError(null);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [data.hook_name, nsName, isCluster, catalogApi]);

  const updateField = useCallback(
    <K extends keyof HookFormData>(field: K, value: HookFormData[K]) => {
      emit({ ...data, [field]: value });
    },
    [data, emit],
  );

  const selectWorkflow = useCallback(
    (key: string) => {
      const [kind, ...rest] = key.split(':');
      const name = rest.join(':');
      const next: HookFormData = {
        ...data,
        workflowKind:
          (kind as HookFormData['workflowKind']) || 'ClusterWorkflow',
        workflowName: name,
      };
      emit(next);
    },
    [data, emit],
  );

  // Pre-add the schema's required inputs the first time a schema loads for
  // this workflow, so the engineer sees what the workflow expects.
  const seededForRef = useRef<string | undefined>();
  useEffect(() => {
    if (!schema || !data.workflowName) return;
    const key = `${data.workflowKind}:${data.workflowName}`;
    if (seededForRef.current === key) return;
    seededForRef.current = key;
    const existing = new Set(data.parameters.map(p => p.name));
    const missing = schema.required.filter(r => !existing.has(r));
    if (missing.length === 0) return;
    emit({
      ...data,
      parameters: [
        ...data.parameters,
        ...missing.map<HookParameterFormRow>(name => ({
          name,
          source: 'required',
          value: '',
          overridable: false,
        })),
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema]);

  const updateParameter = useCallback(
    (index: number, row: HookParameterFormRow) => {
      const parameters = [...data.parameters];
      parameters[index] = row;
      emit({ ...data, parameters });
    },
    [data, emit],
  );
  const addParameter = useCallback(() => {
    emit({
      ...data,
      parameters: [
        ...data.parameters,
        { name: '', source: 'from', value: '', overridable: false },
      ],
    });
  }, [data, emit]);
  const removeParameter = useCallback(
    (index: number) => {
      const parameters = [...data.parameters];
      parameters.splice(index, 1);
      emit({ ...data, parameters });
    },
    [data, emit],
  );

  const toggleEnabledTo = useCallback(
    (opt: Option) => {
      const kind = opt.kind as HookEnabledToFormRow['kind'];
      const present = data.enabledTo.some(
        e => e.kind === kind && e.name === opt.name,
      );
      emit({
        ...data,
        enabledTo: present
          ? data.enabledTo.filter(
              e => !(e.kind === kind && e.name === opt.name),
            )
          : [...data.enabledTo, { kind, name: opt.name }],
      });
    },
    [data, emit],
  );

  const handleModeChange = useCallback(
    (newMode: 'form' | 'yaml') => {
      if (newMode === mode) return;
      if (newMode === 'yaml') {
        setYamlContent(formToYaml(data, scope));
        setYamlError(undefined);
      } else {
        try {
          const parsed = yamlToForm(yamlContent, scope, namespaces);
          emit({ ...data, ...parsed });
          setYamlError(undefined);
        } catch (err) {
          setYamlError(`Failed to parse YAML: ${err}`);
          return;
        }
      }
      setMode(newMode);
    },
    [mode, data, yamlContent, namespaces, scope, emit],
  );

  const handleYamlChange = useCallback(
    (content: string) => {
      setYamlContent(content);
      try {
        YAML.parse(content);
        setYamlError(undefined);
        const parsed = yamlToForm(content, scope, namespaces);
        onChange({ ...data, ...parsed, yamlContent: content });
      } catch (err) {
        setYamlError(`YAML parse error: ${err}`);
      }
    },
    [namespaces, data, onChange, scope],
  );

  const errors = validateHookForm(data, scope);
  const unmapped = unmappedRequiredInputs(schema, data.parameters);
  const nameInvalid =
    !!data.hook_name && !K8S_NAME_PATTERN.test(data.hook_name);
  const workflowKey = data.workflowName
    ? `${isCluster ? 'ClusterWorkflow' : data.workflowKind}:${
        data.workflowName
      }`
    : '';

  return (
    <div>
      <div className={classes.toggleContainer}>
        <FormYamlToggle value={mode} onChange={handleModeChange} />
      </div>

      {mode === 'form' ? (
        <div className={classes.formContainer}>
          <Grid container spacing={2}>
            {!isCluster && (
              <Grid item xs={12} sm={6}>
                <NamespaceSelectField
                  value={data.namespace_name}
                  onChange={v => updateField('namespace_name', v)}
                  label="Namespace"
                  helperText="Namespace where the hook will be created"
                  required
                  onNamespacesLoaded={ns => {
                    setNamespaces(ns);
                    if (!nsPreselectedRef.current && ns.length > 0) {
                      const current = formDataRef.current;
                      if (!current?.namespace_name) {
                        nsPreselectedRef.current = true;
                        const defaultNs = ns.find(n => n.name === 'default');
                        emit({
                          ...DEFAULT_FORM_DATA,
                          ...current,
                          namespace_name: (defaultNs ?? ns[0]).entityRef,
                        });
                      }
                    }
                  }}
                />
              </Grid>
            )}
            <Grid item xs={12} sm={6}>
              <TextField
                label={isCluster ? 'Cluster Hook Name' : 'Hook Name'}
                value={data.hook_name}
                onChange={e => updateField('hook_name', e.target.value)}
                fullWidth
                variant="outlined"
                required
                error={nameInvalid || !!duplicateError}
                helperText={
                  nameInvalid
                    ? 'Must be lowercase alphanumeric with hyphens, starting and ending with alphanumeric'
                    : duplicateError ||
                      'Unique name (must be a valid Kubernetes name)'
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Display Name"
                value={data.displayName}
                onChange={e => updateField('displayName', e.target.value)}
                fullWidth
                variant="outlined"
                helperText="A human-readable display name for the hook"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Description"
                value={data.description}
                onChange={e => updateField('description', e.target.value)}
                fullWidth
                variant="outlined"
                helperText="Describe what this hook checks or does"
              />
            </Grid>
          </Grid>

          <div className={classes.section}>
            <Divider style={{ marginBottom: 16 }} />
            <Typography variant="subtitle2" gutterBottom>
              Workflow
            </Typography>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              The workflow the hook runs.{' '}
              {isCluster
                ? 'A cluster hook may only reference a ClusterWorkflow.'
                : 'Choose a ClusterWorkflow or a Workflow from the hook’s namespace.'}
            </Typography>
            <TextField
              select
              label="Workflow"
              inputProps={{ 'data-testid': 'workflow-select' }}
              value={workflowKey}
              onChange={e => selectWorkflow(e.target.value)}
              fullWidth
              variant="outlined"
              size="small"
              required
              helperText={schemaError ?? ' '}
              error={!!schemaError}
            >
              {workflows.length === 0 && (
                <MenuItem disabled value="">
                  No workflows available
                </MenuItem>
              )}
              {workflows.map(w => (
                <MenuItem
                  key={`${w.kind}:${w.name}`}
                  value={`${w.kind}:${w.name}`}
                >
                  {w.name} {w.kind === 'ClusterWorkflow' ? '(cluster)' : ''}
                </MenuItem>
              ))}
            </TextField>
          </div>

          <div className={classes.section}>
            <Divider style={{ marginBottom: 16 }} />
            <Box display="flex" alignItems="center" style={{ gap: 8 }}>
              <Typography variant="subtitle2">Parameters</Typography>
              <IconButton
                size="small"
                aria-label="Show deployment context paths"
                onClick={() => setShowPaths(v => !v)}
              >
                <HelpOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Map each workflow input to one source. Fixed values and
              non-overridable expressions are set by you; defaults and required
              inputs are supplied by the pipeline binding.
            </Typography>
            <Collapse in={showPaths}>
              <Box className={classes.contextPaths} mb={1}>
                {DEPLOYMENT_CONTEXT_PATHS.map(
                  p => `\${${p.path}}  — ${p.hint}`,
                ).join('\n')}
              </Box>
            </Collapse>
            {unmapped.length > 0 && (
              <Typography className={classes.warningText} gutterBottom>
                Required by the workflow but not mapped: {unmapped.join(', ')}
              </Typography>
            )}
            {data.parameters.map((row, idx) => (
              <ParameterRow
                key={idx}
                row={row}
                index={idx}
                schemaProperties={schema?.properties ?? []}
                onUpdate={updateParameter}
                onRemove={removeParameter}
                classes={classes}
                // Field-level errors appear once the user tries to review
                // (the form reports its validation errors as rawErrors).
                showErrors={!!rawErrors?.length}
                duplicate={
                  data.parameters.filter(p => p.name === row.name).length > 1
                }
              />
            ))}
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={addParameter}
              className={classes.addButton}
            >
              Add Parameter
            </Button>
          </div>

          <div className={classes.section}>
            <Divider style={{ marginBottom: 16 }} />
            <Typography variant="subtitle2" gutterBottom>
              Enabled for
            </Typography>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Restrict the hook to these component types. Leave empty to enable
              it for every component; a pipeline binding can narrow this further
              but never widen it.
            </Typography>
            <Box display="flex" flexWrap="wrap" style={{ gap: 6 }}>
              {componentTypes.length === 0 && (
                <Typography variant="body2" color="textSecondary">
                  No component types found
                </Typography>
              )}
              {componentTypes.map(ct => {
                const selected = data.enabledTo.some(
                  e => e.kind === ct.kind && e.name === ct.name,
                );
                return (
                  <Chip
                    key={`${ct.kind}/${ct.name}`}
                    size="small"
                    clickable
                    color={selected ? 'primary' : 'default'}
                    variant={selected ? 'default' : 'outlined'}
                    label={`${ct.name}${
                      ct.kind === 'ClusterComponentType' ? ' (cluster)' : ''
                    }`}
                    onClick={() => toggleEnabledTo(ct)}
                    aria-pressed={selected}
                  />
                );
              })}
            </Box>
          </div>

          {errors.length > 0 && (
            <div className={classes.errorText} data-testid="hook-form-errors">
              {errors.join('. ')}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className={classes.helpText}>
            <span>
              Edit the {isCluster ? 'ClusterHook' : 'Hook'} CR YAML directly.
              Parameter sources and the workflow reference are validated by the
              control plane on submit.
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
}

export const HookFormWithYamlExtension = (
  props: FieldExtensionComponentProps<HookFormData>,
) => <HookFormWithYaml {...props} scope="namespace" />;

export const ClusterHookFormWithYamlExtension = (
  props: FieldExtensionComponentProps<HookFormData>,
) => <HookFormWithYaml {...props} scope="cluster" />;

export const HookFormWithYamlSchema = {
  returnValue: {
    type: 'object' as const,
    properties: {
      hook_name: { type: 'string' as const },
      namespace_name: { type: 'string' as const },
      displayName: { type: 'string' as const },
      description: { type: 'string' as const },
      workflowKind: { type: 'string' as const },
      workflowName: { type: 'string' as const },
      parameters: { type: 'array' as const },
      enabledTo: { type: 'array' as const },
      yamlContent: { type: 'string' as const },
    },
  },
};

const makeValidation =
  (scope: HookScope) => (value: HookFormData, validation: FieldValidation) => {
    for (const message of validateHookForm(value, scope)) {
      validation.addError(message);
    }
  };

export const hookFormWithYamlValidation = makeValidation('namespace');
export const clusterHookFormWithYamlValidation = makeValidation('cluster');
