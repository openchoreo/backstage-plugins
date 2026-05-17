import { useMemo, useState, type FC } from 'react';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Typography,
} from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import StorageIcon from '@material-ui/icons/Storage';
import type {
  ResourceDependency,
  ResourceTypeOutput,
} from '@openchoreo/backstage-plugin-common';

const useStyles = makeStyles((theme: Theme) => ({
  container: {
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 6,
    marginBottom: theme.spacing(1),
    backgroundColor: theme.palette.background.default,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
  },
  ref: {
    fontWeight: 600,
    fontSize: '0.875rem',
    color: theme.palette.text.primary,
    flex: 1,
  },
  typeChip: {
    height: 20,
    fontSize: '0.7rem',
  },
  bindingsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  bindingRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
    padding: theme.spacing(1),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 4,
  },
  bindingHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  bindingName: {
    fontFamily: 'monospace',
    fontSize: '0.85rem',
    fontWeight: 500,
    flex: 1,
  },
  kindChip: {
    height: 18,
    fontSize: '0.65rem',
  },
  fields: {
    display: 'flex',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  field: {
    flex: 1,
    minWidth: 180,
  },
  emptyHint: {
    fontSize: '0.8rem',
    color: theme.palette.text.hint,
    fontStyle: 'italic',
    padding: theme.spacing(1, 0),
  },
  addButton: {
    marginTop: theme.spacing(1),
    alignSelf: 'flex-start',
  },
}));

export interface ResourceDependencyEditorProps {
  /** The current state of the resource dependency. */
  dependency: ResourceDependency;
  /**
   * Declared outputs of the (Cluster)ResourceType this dependency references.
   * Drives the Add-binding dropdown and per-row kind chips.
   */
  outputs: ResourceTypeOutput[];
  /** Emits the updated dependency on any binding change. */
  onChange: (updated: ResourceDependency) => void;
  /** Drop the entire dependency from the workload. */
  onRemove: () => void;
  /** Disable all controls. */
  disabled?: boolean;
}

type OutputKind = 'value' | 'secretKeyRef' | 'configMapKeyRef' | 'unknown';

/**
 * Determine the source kind of an output by which of value, secretKeyRef, or
 * configMapKeyRef is set. Value-kind outputs can only be bound as env vars;
 * secret/configmap kinds can be bound as env vars and/or file mounts.
 */
function outputKind(output: ResourceTypeOutput): OutputKind {
  if (output.value !== undefined) return 'value';
  if (output.secretKeyRef) return 'secretKeyRef';
  if (output.configMapKeyRef) return 'configMapKeyRef';
  return 'unknown';
}

export const ResourceDependencyEditor: FC<ResourceDependencyEditorProps> = ({
  dependency,
  outputs,
  onChange,
  onRemove,
  disabled = false,
}) => {
  const classes = useStyles();
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null);

  // `?? {}` fallbacks would produce a fresh empty object on every render
  // and bust useMemo identity below; memoize so callers downstream see
  // stable references when the underlying field is undefined.
  const envBindings = useMemo(
    () => dependency.envBindings ?? {},
    [dependency.envBindings],
  );
  const fileBindings = useMemo(
    () => dependency.fileBindings ?? {},
    [dependency.fileBindings],
  );

  // Wired outputs are the union of envBindings + fileBindings keys, preserving
  // a stable order driven by the ResourceType's declared output list with any
  // remaining (out-of-order or orphan) keys appended.
  const wiredOutputNames = useMemo(() => {
    const wired = new Set([
      ...Object.keys(envBindings),
      ...Object.keys(fileBindings),
    ]);
    const orderedFromDeclared = outputs
      .filter(o => wired.has(o.name))
      .map(o => o.name);
    const orphans = [...wired].filter(
      name => !orderedFromDeclared.includes(name),
    );
    return [...orderedFromDeclared, ...orphans];
  }, [envBindings, fileBindings, outputs]);

  const outputByName = useMemo(() => {
    const m = new Map<string, ResourceTypeOutput>();
    outputs.forEach(o => m.set(o.name, o));
    return m;
  }, [outputs]);

  const unboundOutputs = useMemo(() => {
    const wired = new Set(wiredOutputNames);
    return outputs.filter(o => !wired.has(o.name));
  }, [outputs, wiredOutputNames]);

  const emit = (
    nextEnv: Record<string, string>,
    nextFile: Record<string, string>,
  ) => {
    onChange({
      ...dependency,
      envBindings: Object.keys(nextEnv).length ? nextEnv : undefined,
      fileBindings: Object.keys(nextFile).length ? nextFile : undefined,
    });
  };

  const handleEnvChange = (outputName: string, value: string) => {
    const next = { ...envBindings };
    if (value === '') {
      delete next[outputName];
    } else {
      next[outputName] = value;
    }
    emit(next, fileBindings);
  };

  const handleMountChange = (outputName: string, value: string) => {
    const next = { ...fileBindings };
    if (value === '') {
      delete next[outputName];
    } else {
      next[outputName] = value;
    }
    emit(envBindings, next);
  };

  const handleRemoveBinding = (outputName: string) => {
    const env = { ...envBindings };
    const file = { ...fileBindings };
    delete env[outputName];
    delete file[outputName];
    emit(env, file);
  };

  const handleAddBinding = (outputName: string) => {
    // Adding a binding starts as an env-only entry with an empty target;
    // the user types into the env-var field to complete it. Empty values
    // are kubebuilder-rejected, but the editor tolerates the intermediate
    // state so users can type freely.
    const next = { ...envBindings, [outputName]: '' };
    emit(next, fileBindings);
    setAddAnchor(null);
  };

  return (
    <Box className={classes.container} data-testid="resource-dependency-editor">
      <Box className={classes.header}>
        <StorageIcon fontSize="small" color="action" />
        <Typography className={classes.ref}>{dependency.ref}</Typography>
        <Chip
          label="Resource"
          size="small"
          variant="outlined"
          className={classes.typeChip}
        />
        <IconButton
          size="small"
          onClick={onRemove}
          disabled={disabled}
          aria-label="Remove resource dependency"
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box className={classes.bindingsList}>
        {wiredOutputNames.length === 0 ? (
          <Typography className={classes.emptyHint}>
            No bindings yet. Add a binding to wire an output into the container.
          </Typography>
        ) : (
          wiredOutputNames.map(name => {
            const output = outputByName.get(name);
            const kind = output ? outputKind(output) : 'unknown';
            const mountDisabled = kind === 'value';
            return (
              <Box
                key={name}
                className={classes.bindingRow}
                data-testid={`binding-row-${name}`}
              >
                <Box className={classes.bindingHeader}>
                  <Typography className={classes.bindingName}>
                    {name}
                  </Typography>
                  <Chip
                    label={kind}
                    size="small"
                    variant="outlined"
                    className={classes.kindChip}
                  />
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveBinding(name)}
                    disabled={disabled}
                    aria-label={`Remove binding ${name}`}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
                <Box className={classes.fields}>
                  <TextField
                    label="Env var"
                    variant="outlined"
                    size="small"
                    className={classes.field}
                    value={envBindings[name] ?? ''}
                    disabled={disabled}
                    onChange={e => handleEnvChange(name, e.target.value)}
                    placeholder="e.g. DB_HOST"
                    inputProps={{ 'data-testid': `env-input-${name}` }}
                  />
                  <TextField
                    label="Mount path"
                    variant="outlined"
                    size="small"
                    className={classes.field}
                    value={fileBindings[name] ?? ''}
                    disabled={disabled || mountDisabled}
                    onChange={e => handleMountChange(name, e.target.value)}
                    placeholder={
                      mountDisabled
                        ? 'Not available for value-kind outputs'
                        : 'e.g. /etc/secrets/db'
                    }
                    inputProps={{ 'data-testid': `mount-input-${name}` }}
                  />
                </Box>
              </Box>
            );
          })
        )}
      </Box>

      <Button
        startIcon={<AddIcon />}
        onClick={e => setAddAnchor(e.currentTarget)}
        variant="outlined"
        size="small"
        className={classes.addButton}
        disabled={disabled || unboundOutputs.length === 0}
      >
        Add binding
      </Button>
      <Menu
        anchorEl={addAnchor}
        open={Boolean(addAnchor)}
        onClose={() => setAddAnchor(null)}
      >
        {unboundOutputs.map(o => (
          <MenuItem key={o.name} onClick={() => handleAddBinding(o.name)}>
            {o.name}{' '}
            <Typography
              variant="caption"
              color="textSecondary"
              style={{ marginLeft: 8 }}
            >
              {outputKind(o)}
            </Typography>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};
