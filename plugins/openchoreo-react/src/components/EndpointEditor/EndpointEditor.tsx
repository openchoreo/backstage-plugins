import { useEffect, useMemo, useState, type FC } from 'react';
import {
  TextField,
  IconButton,
  Grid,
  Box,
  Typography,
  Button,
  Select,
  MenuItem,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@material-ui/core';
import Autocomplete from '@material-ui/lab/Autocomplete';
import { makeStyles, Theme } from '@material-ui/core/styles';
import DeleteIcon from '@material-ui/icons/Delete';
import EditIcon from '@material-ui/icons/Edit';
import CheckIcon from '@material-ui/icons/Check';
import CloseIcon from '@material-ui/icons/Close';
import CodeMirror from '@uiw/react-codemirror';
import { StreamLanguage } from '@codemirror/language';
import type { StreamParser } from '@codemirror/language';
import { yaml as yamlMode } from '@codemirror/legacy-modes/mode/yaml';
import { protobuf as protobufMode } from '@codemirror/legacy-modes/mode/protobuf';
import { graphql as graphqlMode } from 'codemirror-graphql/cm6-legacy/mode';
import type { WorkloadEndpoint } from '@openchoreo/backstage-plugin-common';

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
  actionButton: {
    marginLeft: theme.spacing(0.5),
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
    marginLeft: theme.spacing(1),
  },
  readOnlyContent: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0.5, 0),
  },
  nameField: {
    marginBottom: theme.spacing(1.5),
  },
  visibilityFieldset: {
    border: `1px solid ${
      theme.palette.type === 'light'
        ? 'rgba(0, 0, 0, 0.12)'
        : 'rgba(255, 255, 255, 0.12)'
    }`,
    borderRadius: 4,
    padding: theme.spacing(0.5, 1),
    margin: 0,
    marginBottom: theme.spacing(0.5),
  },
  schemaContentField: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(0.5),
  },
  schemaEditor: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 4,
    overflow: 'hidden',
    '& .cm-editor': { height: '400px' },
    '& .cm-scroller': { overflow: 'auto' },
  },
  schemaEditorError: {
    border: `1px solid ${theme.palette.error.main}`,
    borderRadius: 4,
    overflow: 'hidden',
    '& .cm-editor': { height: '400px' },
    '& .cm-scroller': { overflow: 'auto' },
  },
}));

const PROTOCOL_TYPES = [
  'TCP',
  'UDP',
  'HTTP',
  'gRPC',
  'Websocket',
  'GraphQL',
] as const;

const SCHEMA_TYPE_OPTIONS = ['openapi', 'asyncapi', 'grpc', 'graphql'];

const ENDPOINT_TYPE_TO_SCHEMA_TYPE: Record<string, string> = {
  HTTP: 'openapi',
  gRPC: 'grpc',
  GraphQL: 'graphql',
  Websocket: 'asyncapi',
};

const SCHEMA_REQUIRED_TYPES = new Set(['gRPC']);

const SCHEMA_TYPE_LANGUAGE_MAP: Record<string, StreamParser<any>> = {
  openapi: yamlMode,
  asyncapi: yamlMode,
  grpc: protobufMode,
  graphql: graphqlMode,
};

const VISIBILITY_LABELS: Record<string, string> = {
  external: 'External',
  project: 'Project',
  namespace: 'Namespace',
  internal: 'Internal',
};

const VISIBILITY_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
  disabled: boolean;
  alwaysSelected?: boolean;
}> = [
  {
    value: 'project',
    label: VISIBILITY_LABELS.project,
    disabled: true,
    alwaysSelected: true,
  },
  { value: 'namespace', label: VISIBILITY_LABELS.namespace, disabled: false },
  { value: 'internal', label: VISIBILITY_LABELS.internal, disabled: false },
  { value: 'external', label: VISIBILITY_LABELS.external, disabled: false },
];

/** Dialog for editing schema content with syntax highlighting */
const SchemaContentDialog: FC<{
  open: boolean;
  content: string;
  schemaType?: string;
  onApply: (content: string) => void;
  onClose: () => void;
  required: boolean;
}> = ({ open, content, schemaType, onApply, onClose, required }) => {
  const classes = useStyles();
  const [draft, setDraft] = useState(content);
  const showError = required && !draft.trim();

  // Reset draft when dialog opens
  useEffect(() => {
    if (open) setDraft(content);
  }, [open, content]);

  const languageExtension = useMemo(() => {
    const mode =
      SCHEMA_TYPE_LANGUAGE_MAP[schemaType?.toLowerCase() ?? ''] ?? yamlMode;
    return StreamLanguage.define(mode);
  }, [schemaType]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit Schema Content</DialogTitle>
      <DialogContent>
        <div
          className={
            showError ? classes.schemaEditorError : classes.schemaEditor
          }
        >
          <CodeMirror
            value={draft}
            onChange={setDraft}
            extensions={[languageExtension]}
            theme="light"
          />
        </div>
        {showError && (
          <Typography variant="caption" color="error" style={{ marginTop: 4 }}>
            Schema content is required for this endpoint type.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => onApply(draft)}
          color="primary"
          variant="contained"
          disabled={showError}
        >
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export interface EndpointEditorProps {
  /** The endpoint name */
  endpointName: string;
  /** The endpoint to edit */
  endpoint: WorkloadEndpoint;
  /** Whether the editor is disabled */
  disabled?: boolean;
  /** Optional CSS class name */
  className?: string;
  /** Whether this row is in edit mode */
  isEditing: boolean;
  /** Called when Edit button clicked */
  onEdit: () => void;
  /** Called when Apply button clicked */
  onApply: () => void;
  /** Called when Cancel button clicked */
  onCancel?: () => void;
  /** Separately disable the Edit button (when another row is editing) */
  editDisabled?: boolean;
  /** Separately disable the Delete button (when another row is editing) */
  deleteDisabled?: boolean;
  /** Disable the Apply button (when validation fails) */
  applyDisabled?: boolean;
  /** Callback when any field changes */
  onChange: (field: keyof WorkloadEndpoint, value: any) => void;
  /** Callback when the endpoint name changes */
  onNameChange: (name: string) => void;
  /** Callback when the endpoint should be removed */
  onRemove: () => void;
}

/**
 * Editor component for a single endpoint.
 * Has two visual states: read-only (displays values) and edit mode (input fields).
 */
export const EndpointEditor: FC<EndpointEditorProps> = ({
  endpointName,
  endpoint,
  disabled = false,
  className,
  isEditing,
  onEdit,
  onApply,
  onCancel,
  editDisabled = false,
  deleteDisabled = false,
  applyDisabled = false,
  onChange,
  onNameChange,
  onRemove,
}) => {
  const classes = useStyles();
  const [schemaDialogOpen, setSchemaDialogOpen] = useState(false);

  const isSchemaRequired = SCHEMA_REQUIRED_TYPES.has(endpoint.type);

  // Read-only display
  if (!isEditing) {
    return (
      <Box className={className || classes.container}>
        <Box display="flex" alignItems="center">
          <Box flex={1} className={classes.readOnlyContent}>
            <Typography className={classes.readOnlyName}>
              {endpointName || '(no name)'}
            </Typography>
            <Typography className={classes.readOnlyDetails}>
              {endpoint.type} : {endpoint.port}
              {endpoint.schema?.type && (
                <> &middot; Schema: {endpoint.schema.type}</>
              )}
              {(() => {
                const vis = endpoint.visibility ?? [];
                const displayVis = vis.includes('project')
                  ? vis
                  : ['project', ...vis];
                return displayVis.length > 0 ? (
                  <>
                    {' '}
                    &middot;{' '}
                    {displayVis.map(v => VISIBILITY_LABELS[v] ?? v).join(', ')}
                  </>
                ) : null;
              })()}
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
            aria-label="Remove endpoint"
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      </Box>
    );
  }

  // Edit mode
  return (
    <Box className={className || classes.containerEditing}>
      <Box display="flex" alignItems="flex-start">
        <Box flex={1}>
          <TextField
            label="Endpoint Name"
            value={endpointName || ''}
            onChange={e => onNameChange(e.target.value)}
            fullWidth
            variant="outlined"
            size="small"
            disabled={disabled}
            className={classes.nameField}
          />
          <Grid container spacing={1} alignItems="center">
            <Grid item xs={6}>
              <FormControl fullWidth variant="outlined" size="small">
                <InputLabel>Type</InputLabel>
                <Select
                  value={endpoint.type || 'HTTP'}
                  onChange={e => {
                    const newType = e.target.value as string;
                    onChange('type', newType);
                    const suggestedSchemaType =
                      ENDPOINT_TYPE_TO_SCHEMA_TYPE[newType];
                    if (suggestedSchemaType) {
                      onChange('schema', {
                        ...endpoint.schema,
                        type: suggestedSchemaType,
                      });
                    }
                  }}
                  label="Type"
                  disabled={disabled}
                >
                  {PROTOCOL_TYPES.map(type => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Port"
                type="number"
                value={endpoint.port || ''}
                onChange={e =>
                  onChange('port', parseInt(e.target.value, 10) || 0)
                }
                fullWidth
                variant="outlined"
                size="small"
                disabled={disabled}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl
                component="fieldset"
                size="small"
                fullWidth
                disabled={disabled}
                className={classes.visibilityFieldset}
              >
                <FormLabel
                  component="legend"
                  style={{ fontSize: '0.75rem', padding: '0 4px' }}
                >
                  Visibility
                </FormLabel>
                <FormGroup row>
                  {VISIBILITY_OPTIONS.map(opt => {
                    const currentVisibility = endpoint.visibility ?? [];
                    const isChecked =
                      opt.alwaysSelected ||
                      (currentVisibility as string[]).includes(opt.value);
                    return (
                      <FormControlLabel
                        key={opt.value}
                        control={
                          <Checkbox
                            checked={isChecked}
                            onChange={() => {
                              if (opt.alwaysSelected || opt.disabled) return;
                              const next = isChecked
                                ? currentVisibility.filter(v => v !== opt.value)
                                : [...currentVisibility, opt.value];
                              onChange('visibility', next);
                            }}
                            size="small"
                            color="primary"
                          />
                        }
                        label={opt.label}
                        disabled={disabled || opt.disabled}
                      />
                    );
                  })}
                </FormGroup>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <Autocomplete
                freeSolo
                options={SCHEMA_TYPE_OPTIONS}
                value={endpoint.schema?.type || ''}
                onInputChange={(_e, newValue) =>
                  onChange('schema', {
                    ...endpoint.schema,
                    type: newValue,
                  })
                }
                disabled={disabled}
                renderInput={params => (
                  <TextField
                    {...params}
                    label="Schema Type"
                    variant="outlined"
                    size="small"
                    placeholder="e.g., openapi, grpc"
                    helperText={
                      isSchemaRequired
                        ? 'Required for gRPC endpoints'
                        : 'Optional'
                    }
                  />
                )}
              />
            </Grid>
            <Grid item xs={6}>
              <Box className={classes.schemaContentField}>
                <TextField
                  label="Schema Content"
                  value={
                    endpoint.schema?.content
                      ? `${endpoint.schema.content.substring(0, 60)}${
                          endpoint.schema.content.length > 60 ? '...' : ''
                        }`
                      : ''
                  }
                  fullWidth
                  variant="outlined"
                  size="small"
                  disabled
                  placeholder={
                    isSchemaRequired
                      ? 'Required - click to add'
                      : 'Optional - click to add'
                  }
                  error={isSchemaRequired && !endpoint.schema?.content?.trim()}
                  helperText={
                    isSchemaRequired
                      ? 'Required - paste your protobuf schema'
                      : 'Optional'
                  }
                  InputProps={{
                    readOnly: true,
                  }}
                />
                <IconButton
                  size="small"
                  onClick={() => setSchemaDialogOpen(true)}
                  disabled={disabled}
                  aria-label="Edit schema"
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Box>
              <SchemaContentDialog
                open={schemaDialogOpen}
                content={endpoint.schema?.content || ''}
                schemaType={endpoint.schema?.type}
                required={isSchemaRequired}
                onApply={content => {
                  onChange('schema', {
                    ...endpoint.schema,
                    content,
                  });
                  setSchemaDialogOpen(false);
                }}
                onClose={() => setSchemaDialogOpen(false)}
              />
            </Grid>
          </Grid>
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
          {onCancel && (
            <IconButton
              onClick={onCancel}
              size="small"
              disabled={disabled}
              className={classes.actionButton}
              aria-label="Cancel editing"
            >
              <CloseIcon />
            </IconButton>
          )}
          <IconButton
            onClick={onRemove}
            color="secondary"
            size="small"
            disabled={disabled}
            className={classes.actionButton}
            aria-label="Remove endpoint"
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
};
