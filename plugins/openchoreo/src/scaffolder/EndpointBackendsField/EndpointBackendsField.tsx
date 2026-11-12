import { useEffect } from 'react';
import {
  Box,
  Button,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import type { FieldValidation } from '@rjsf/utils';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import {
  projectKey,
  readProjectNamespace,
  useProjectWorkloadEndpoints,
} from './useProjectWorkloadEndpoints';

/** The Endpoint CRD's limits on backends. */
export const MAX_BACKENDS = 16;
export const MAX_WEIGHT = 1_000_000;

/** One backend as the scaffolder action receives it. */
export interface EndpointBackendValue {
  name: string;
  component: string;
  endpoint: string;
  weight?: number;
}

const useStyles = makeStyles(theme => ({
  row: {
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'flex-start',
    marginBottom: theme.spacing(1),
  },
  select: {
    flex: 2,
  },
  weight: {
    flex: 1,
    maxWidth: 120,
  },
  hint: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1),
  },
}));

const BACKEND_NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

/**
 * Derives a backend's name from its component and workload endpoint, made
 * unique within the list. Backend names key the Endpoint's backendRefs.
 */
export function deriveBackendName(
  component: string,
  endpoint: string,
  taken: string[],
): string {
  const base = `${component}-${endpoint}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    // Cut before trimming, so a cut just after a hyphen can't leave the name
    // ending in one.
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');
  let name = base;
  for (let i = 2; taken.includes(name); i++) {
    name = `${base}-${i}`;
  }
  return name;
}

/**
 * Picks the backends an Endpoint routes traffic to: rows of component, one of
 * its workload endpoints, and a relative weight. Options come from the
 * Workloads of the components in the project chosen earlier in the form.
 */
export const EndpointBackendsField = ({
  formData,
  onChange,
  formContext,
  uiSchema,
  rawErrors,
}: FieldExtensionComponentProps<EndpointBackendValue[]>) => {
  const classes = useStyles();
  const projectField =
    (uiSchema?.['ui:options']?.projectNamespaceField as string) ??
    'project_namespace';
  const { project, namespace } = readProjectNamespace(
    formContext?.formData,
    projectField,
  );
  const {
    options,
    components: projectComponents,
    loading,
    error,
    loadedFor,
  } = useProjectWorkloadEndpoints(namespace, project);
  const components = [...new Set(options.map(o => o.component))];
  const backends = formData ?? [];

  const update = (next: EndpointBackendValue[]) => onChange(next);

  // Going back and picking another project leaves the rows chosen for the old
  // one. Once the new project has loaded, drop the rows whose component is
  // not in it. Membership comes from the catalog, not from the endpoints that
  // loaded, so a component whose Workload failed to load keeps its rows.
  const currentKey = project && namespace ? projectKey(namespace, project) : '';
  useEffect(() => {
    if (!currentKey || loadedFor !== currentKey || error) return;
    const inProject = new Set(projectComponents);
    const kept = backends.filter(
      b => !b.component || inProject.has(b.component),
    );
    if (kept.length !== backends.length) onChange(kept);
    // Run when the options for a project arrive, not on every row edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey, loadedFor, projectComponents, error]);

  const setRow = (index: number, patch: Partial<EndpointBackendValue>) => {
    const next = backends.map((b, i) => (i === index ? { ...b, ...patch } : b));
    const row = next[index];
    if ((patch.component || patch.endpoint) && row.component && row.endpoint) {
      row.name = deriveBackendName(
        row.component,
        row.endpoint,
        next.filter((_, i) => i !== index).map(b => b.name),
      );
    }
    update(next);
  };

  const addRow = () =>
    update([
      ...backends,
      {
        name: '',
        component: '',
        endpoint: '',
        weight: backends.length ? 0 : 100,
      },
    ]);

  if (!project || !namespace) {
    return (
      <Typography variant="body2" className={classes.hint}>
        Select a project first.
      </Typography>
    );
  }

  return (
    <Box>
      <Typography variant="body2" className={classes.hint}>
        Route traffic to workload endpoints of components in {project}, up to{' '}
        {MAX_BACKENDS} backends. Weights are relative; a backend with weight 0
        gets no traffic.
      </Typography>
      {error && (
        <Typography variant="body2" color="error">
          Failed to load workload endpoints: {error.message}
        </Typography>
      )}
      {!loading && !error && options.length === 0 && (
        <Typography variant="body2" color="error">
          No component in {project} has a workload endpoint to route to.
        </Typography>
      )}

      {backends.map((backend, index) => {
        const endpointsOfComponent = options.filter(
          o => o.component === backend.component,
        );
        return (
          <Box key={index} className={classes.row}>
            <TextField
              select
              label="Component"
              variant="outlined"
              size="small"
              className={classes.select}
              value={backend.component}
              disabled={loading}
              SelectProps={{
                SelectDisplayProps: {
                  'aria-label': `Component for backend ${index + 1}`,
                } as any,
              }}
              onChange={e =>
                setRow(index, { component: e.target.value, endpoint: '' })
              }
            >
              {components.map(c => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Workload endpoint"
              variant="outlined"
              size="small"
              className={classes.select}
              value={backend.endpoint}
              disabled={!backend.component}
              SelectProps={{
                SelectDisplayProps: {
                  'aria-label': `Workload endpoint for backend ${index + 1}`,
                } as any,
              }}
              onChange={e => setRow(index, { endpoint: e.target.value })}
            >
              {endpointsOfComponent.map(o => (
                <MenuItem key={o.endpoint} value={o.endpoint}>
                  {o.endpoint}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Weight"
              type="number"
              variant="outlined"
              size="small"
              className={classes.weight}
              inputProps={{ min: 0, max: MAX_WEIGHT, step: 1 }}
              value={backend.weight ?? ''}
              onChange={e =>
                setRow(index, {
                  weight:
                    e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
            />
            <IconButton
              aria-label={`Remove backend ${index + 1}`}
              onClick={() => update(backends.filter((_, i) => i !== index))}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Box>
        );
      })}

      <Button
        size="small"
        color="primary"
        startIcon={<AddIcon />}
        onClick={addRow}
        disabled={
          loading || options.length === 0 || backends.length >= MAX_BACKENDS
        }
      >
        Add backend
      </Button>
      {rawErrors?.map(err => (
        <Typography key={err} variant="caption" color="error" component="div">
          {err}
        </Typography>
      ))}
    </Box>
  );
};

export const EndpointBackendsFieldSchema = {
  returnValue: {
    type: 'array' as const,
    items: { type: 'object' as const },
  },
};

/**
 * Every row needs a component and workload endpoint, a valid unique name and
 * a whole weight from 0 to {@link MAX_WEIGHT}, at least one backend must take
 * traffic, and there can be at most {@link MAX_BACKENDS} backends.
 */
export const endpointBackendsFieldValidation = (
  value: EndpointBackendValue[] | undefined,
  validation: FieldValidation,
) => {
  const backends = value ?? [];
  if (backends.length === 0) {
    validation.addError('Add at least one backend.');
    return;
  }
  if (backends.length > MAX_BACKENDS) {
    validation.addError(`An Endpoint takes at most ${MAX_BACKENDS} backends.`);
  }
  const names = new Set<string>();
  backends.forEach((b, i) => {
    const row = `Backend ${i + 1}`;
    if (!b.component || !b.endpoint) {
      validation.addError(`${row}: pick a component and a workload endpoint.`);
      return;
    }
    if (!BACKEND_NAME_PATTERN.test(b.name)) {
      validation.addError(`${row}: name "${b.name}" is not a valid name.`);
    } else if (names.has(b.name)) {
      validation.addError(`${row}: name "${b.name}" is already used.`);
    }
    names.add(b.name);
    if (
      b.weight !== undefined &&
      (!Number.isInteger(b.weight) || b.weight < 0 || b.weight > MAX_WEIGHT)
    ) {
      validation.addError(
        `${row}: weight must be a whole number from 0 to ${MAX_WEIGHT.toLocaleString(
          'en-US',
        )}.`,
      );
    }
  });
  // A missing weight defaults to 1 on the Endpoint.
  if (backends.every(b => b.weight === 0)) {
    validation.addError('At least one backend needs a weight above 0.');
  }
};
