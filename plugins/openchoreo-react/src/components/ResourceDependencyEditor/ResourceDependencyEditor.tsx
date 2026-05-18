import { useMemo, useState, type FC } from 'react';
import {
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import CheckIcon from '@material-ui/icons/Check';
import CloseIcon from '@material-ui/icons/Close';
import DeleteIcon from '@material-ui/icons/Delete';
import EditIcon from '@material-ui/icons/Edit';
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
  containerEditing: {
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.primary.main}`,
    borderRadius: 6,
    marginBottom: theme.spacing(1),
    backgroundColor: theme.palette.background.default,
    boxShadow: `0 0 0 1px ${theme.palette.primary.main}`,
  },
  readOnlyContent: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0.5, 0),
    gap: theme.spacing(1),
  },
  readOnlyName: {
    fontWeight: 600,
    fontSize: '0.875rem',
    color: theme.palette.text.primary,
  },
  readOnlyDetails: {
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
    fontFamily: 'monospace',
  },
  typeChip: {
    height: 20,
    fontSize: '0.7rem',
  },
  actionButton: {
    marginLeft: theme.spacing(0.5),
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
  },
  refSelect: {
    minWidth: 240,
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
  fieldWithRemove: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    flex: 1,
    minWidth: 200,
  },
  field: {
    flex: 1,
    minWidth: 0,
  },
  emptyHint: {
    fontSize: '0.8rem',
    color: theme.palette.text.hint,
    fontStyle: 'italic',
    padding: theme.spacing(1, 0),
  },
  addButtonRow: {
    display: 'flex',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
    flexWrap: 'wrap',
  },
}));

/** Lightweight option shape for the in-row Resource picker. */
export interface ResourceOption {
  /** Resource name (the binding `ref`). */
  name: string;
  /** Optional ResourceType display name, shown as a caption next to the option. */
  resourceType?: string;
}

export interface ResourceDependencyEditorProps {
  /**
   * Current state of the resource dependency: when `isEditing` is true this
   * is the live edit buffer driven by `onChange`, otherwise it is the
   * stored value.
   */
  dependency: ResourceDependency;
  /**
   * Declared outputs of the (Cluster)ResourceType this dependency references.
   * Drives the Add-binding dropdown and per-row kind chips.
   */
  outputs: ResourceTypeOutput[];
  /**
   * Resources the user can pick from in edit mode. Caller should filter
   * out resources already claimed by OTHER rows so duplicates don't appear.
   */
  availableResources?: ResourceOption[];
  /** Whether this row is in edit mode (expanded form). */
  isEditing: boolean;
  /** Begin editing this row (parent flips `isEditing` to true). */
  onEdit: () => void;
  /** Commit the buffered changes (parent flips `isEditing` to false). */
  onApply: () => void;
  /** Discard buffered changes (parent flips `isEditing` to false; new rows are removed). */
  onCancel: () => void;
  /**
   * Push the updated dependency into the edit buffer. Only invoked during
   * edit mode; parent's external state is unchanged until `onApply`.
   */
  onChange: (updated: ResourceDependency) => void;
  /** Drop the entire dependency from the workload. */
  onRemove: () => void;
  /** Disable all controls. */
  disabled?: boolean;
  /** Disable Edit button (e.g. another row is currently being edited). */
  editDisabled?: boolean;
  /** Disable Remove button (e.g. another row is currently being edited). */
  deleteDisabled?: boolean;
  /** Disable Apply button (e.g. buffer is invalid). */
  applyDisabled?: boolean;
}

type OutputKind = 'value' | 'secretKeyRef' | 'configMapKeyRef' | 'unknown';

function outputKind(output: ResourceTypeOutput): OutputKind {
  if (output.value !== undefined) return 'value';
  if (output.secretKeyRef) return 'secretKeyRef';
  if (output.configMapKeyRef) return 'configMapKeyRef';
  return 'unknown';
}

/**
 * Editor for a single Workload.spec.dependencies.resources[] entry.
 * Mirrors the endpoint DependencyEditor pattern: collapses to a compact
 * one-line summary in read-only mode, expands to a full per-output binding
 * form in edit mode. Changes are buffered via `onChange` until the caller
 * commits with `onApply` or discards with `onCancel`.
 */
export const ResourceDependencyEditor: FC<ResourceDependencyEditorProps> = ({
  dependency,
  outputs,
  availableResources = [],
  isEditing,
  onEdit,
  onApply,
  onCancel,
  onChange,
  onRemove,
  disabled = false,
  editDisabled = false,
  deleteDisabled = false,
  applyDisabled = false,
}) => {
  const classes = useStyles();
  const [envAddAnchor, setEnvAddAnchor] = useState<HTMLElement | null>(null);
  const [fileAddAnchor, setFileAddAnchor] = useState<HTMLElement | null>(null);

  const envBindings = useMemo(
    () => dependency.envBindings ?? {},
    [dependency.envBindings],
  );
  const fileBindings = useMemo(
    () => dependency.fileBindings ?? {},
    [dependency.fileBindings],
  );

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

  // Per-kind unbound lists for the two Add buttons. The env list shows
  // anything not currently in envBindings (any kind). The file list
  // hides value-kind outputs because the backend rejects mounting a
  // literal value as a file.
  const envUnboundOutputs = useMemo(
    () => outputs.filter(o => !(o.name in envBindings)),
    [outputs, envBindings],
  );
  const fileUnboundOutputs = useMemo(
    () =>
      outputs.filter(
        o => !(o.name in fileBindings) && outputKind(o) !== 'value',
      ),
    [outputs, fileBindings],
  );

  // The currently-selected ref must remain in the picker's option list so
  // users don't lose their pick if the parent excludes it (e.g. another
  // row claimed it).
  const refOptions: ResourceOption[] = useMemo(() => {
    if (
      dependency.ref &&
      !availableResources.some(o => o.name === dependency.ref)
    ) {
      return [{ name: dependency.ref }, ...availableResources];
    }
    return availableResources;
  }, [availableResources, dependency.ref]);

  // Read-only summary line: "5 env, 1 file binding" — terse so the row
  // stays a single visual unit. Counts only; the user clicks Edit to see
  // the full binding details.
  const summary = useMemo(() => {
    const env = Object.keys(envBindings).length;
    const file = Object.keys(fileBindings).length;
    const parts: string[] = [];
    if (env > 0) parts.push(`${env} env`);
    if (file > 0) parts.push(`${file} file`);
    if (parts.length === 0) return 'no bindings';
    return `${parts.join(', ')} binding${env + file === 1 ? '' : 's'}`;
  }, [envBindings, fileBindings]);

  if (!isEditing) {
    return (
      <Box className={classes.container}>
        <Box display="flex" alignItems="center">
          <Box flex={1} className={classes.readOnlyContent}>
            <Typography className={classes.readOnlyName}>
              {dependency.ref || '(no resource)'}
            </Typography>
            <Chip
              label="Resource"
              size="small"
              variant="outlined"
              className={classes.typeChip}
            />
            <Typography className={classes.readOnlyDetails}>
              {summary}
            </Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={onEdit}
            disabled={disabled || editDisabled}
            className={classes.actionButton}
          >
            Edit
          </Button>
          <IconButton
            onClick={onRemove}
            color="secondary"
            size="small"
            disabled={disabled || deleteDisabled}
            className={classes.actionButton}
            aria-label="Remove resource dependency"
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      </Box>
    );
  }

  // Buffered edit-mode handlers. Each one builds the next buffer object
  // and pushes it through `onChange`; parent state is unchanged until
  // `onApply` fires.
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

  // Field edits set the value as-is (even empty). Removing a binding kind
  // is an explicit action through the per-field ✕ button; clearing the
  // text alone keeps the entry so the user doesn't lose the binding on
  // accident while retyping. Empty values keep the buffer invalid (Apply
  // disabled) until the user fills them in or explicitly removes.
  const handleEnvChange = (outputName: string, value: string) => {
    emit({ ...envBindings, [outputName]: value }, fileBindings);
  };

  const handleMountChange = (outputName: string, value: string) => {
    emit(envBindings, { ...fileBindings, [outputName]: value });
  };

  const handleRemoveEnvBinding = (outputName: string) => {
    const env = { ...envBindings };
    delete env[outputName];
    emit(env, fileBindings);
  };

  const handleRemoveFileBinding = (outputName: string) => {
    const file = { ...fileBindings };
    delete file[outputName];
    emit(envBindings, file);
  };

  const handleRemoveBinding = (outputName: string) => {
    const env = { ...envBindings };
    const file = { ...fileBindings };
    delete env[outputName];
    delete file[outputName];
    emit(env, file);
  };

  const handleAddEnvBinding = (outputName: string) => {
    // Insert with an empty target; the user types into the env-var field
    // to complete it. Empty values are kubebuilder-rejected, so the
    // buffer reports invalid until filled.
    emit({ ...envBindings, [outputName]: '' }, fileBindings);
    setEnvAddAnchor(null);
  };

  const handleAddFileBinding = (outputName: string) => {
    emit(envBindings, { ...fileBindings, [outputName]: '' });
    setFileAddAnchor(null);
  };

  const handleRefChange = (nextRef: string) => {
    // Switching the ref invalidates the existing bindings — each
    // (Cluster)ResourceType declares its own outputs, so a binding for
    // `host` against postgres has no meaning against nats. Clear the
    // binding maps when the ref changes.
    if (nextRef === dependency.ref) return;
    onChange({
      ...dependency,
      ref: nextRef,
      envBindings: undefined,
      fileBindings: undefined,
    });
  };

  return (
    <Box
      className={classes.containerEditing}
      data-testid="resource-dependency-editor"
    >
      <Box display="flex" alignItems="flex-start">
        <Box flex={1}>
          <Box className={classes.header}>
            <FormControl
              variant="outlined"
              size="small"
              className={classes.refSelect}
            >
              <InputLabel>Resource</InputLabel>
              <Select
                value={dependency.ref || ''}
                onChange={e => handleRefChange(e.target.value as string)}
                label="Resource"
                disabled={disabled}
                inputProps={{ 'data-testid': 'resource-ref-select' }}
              >
                {refOptions.map(option => (
                  <MenuItem key={option.name} value={option.name}>
                    {option.name}
                    {option.resourceType && (
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        style={{ marginLeft: 8 }}
                      >
                        {option.resourceType}
                      </Typography>
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box className={classes.bindingsList}>
            {wiredOutputNames.length === 0 ? (
              <Typography className={classes.emptyHint}>
                No bindings yet. Add a binding to wire an output into the
                container.
              </Typography>
            ) : (
              wiredOutputNames.map(name => {
                const output = outputByName.get(name);
                const kind = output ? outputKind(output) : 'unknown';
                const hasEnvBinding = name in envBindings;
                const hasFileBinding = name in fileBindings;
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
                      {hasEnvBinding && (
                        <Box className={classes.fieldWithRemove}>
                          <TextField
                            label="Env var"
                            variant="outlined"
                            size="small"
                            className={classes.field}
                            value={envBindings[name] ?? ''}
                            disabled={disabled}
                            onChange={e =>
                              handleEnvChange(name, e.target.value)
                            }
                            placeholder="e.g. DB_HOST"
                            inputProps={{
                              'data-testid': `env-input-${name}`,
                            }}
                          />
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveEnvBinding(name)}
                            disabled={disabled}
                            aria-label={`Remove env binding ${name}`}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      )}
                      {hasFileBinding && (
                        <Box className={classes.fieldWithRemove}>
                          <TextField
                            label="Mount path"
                            variant="outlined"
                            size="small"
                            className={classes.field}
                            value={fileBindings[name] ?? ''}
                            disabled={disabled}
                            onChange={e =>
                              handleMountChange(name, e.target.value)
                            }
                            placeholder="e.g. /etc/secrets/db"
                            inputProps={{
                              'data-testid': `mount-input-${name}`,
                            }}
                          />
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveFileBinding(name)}
                            disabled={disabled}
                            aria-label={`Remove file mount ${name}`}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      )}
                    </Box>
                  </Box>
                );
              })
            )}
          </Box>

          <Box className={classes.addButtonRow}>
            <Button
              startIcon={<AddIcon />}
              onClick={e => setEnvAddAnchor(e.currentTarget)}
              variant="outlined"
              size="small"
              disabled={disabled || envUnboundOutputs.length === 0}
            >
              Add env binding
            </Button>
            <Button
              startIcon={<AddIcon />}
              onClick={e => setFileAddAnchor(e.currentTarget)}
              variant="outlined"
              size="small"
              disabled={disabled || fileUnboundOutputs.length === 0}
            >
              Add file mount
            </Button>
            <Menu
              anchorEl={envAddAnchor}
              open={Boolean(envAddAnchor)}
              onClose={() => setEnvAddAnchor(null)}
            >
              {envUnboundOutputs.map(o => (
                <MenuItem
                  key={o.name}
                  onClick={() => handleAddEnvBinding(o.name)}
                >
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
            <Menu
              anchorEl={fileAddAnchor}
              open={Boolean(fileAddAnchor)}
              onClose={() => setFileAddAnchor(null)}
            >
              {fileUnboundOutputs.map(o => (
                <MenuItem
                  key={o.name}
                  onClick={() => handleAddFileBinding(o.name)}
                >
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
        </Box>

        <Box display="flex" flexDirection="column" ml={1}>
          <IconButton
            onClick={onApply}
            color="primary"
            size="small"
            disabled={disabled || applyDisabled}
            className={classes.actionButton}
            aria-label="Apply changes"
          >
            <CheckIcon />
          </IconButton>
          <IconButton
            onClick={onCancel}
            size="small"
            disabled={disabled}
            className={classes.actionButton}
            aria-label="Cancel editing"
          >
            <CloseIcon />
          </IconButton>
          <IconButton
            onClick={onRemove}
            color="secondary"
            size="small"
            disabled={disabled}
            className={classes.actionButton}
            aria-label="Remove resource dependency"
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
};
