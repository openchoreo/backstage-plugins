import {
  useEffect,
  useId,
  useMemo,
  useState,
  type FC,
  type ReactNode,
} from 'react';
import {
  TextField,
  IconButton,
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
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';
import EditIcon from '@material-ui/icons/Edit';
import CodeMirror from '@uiw/react-codemirror';
import { StreamLanguage } from '@codemirror/language';
import type { StreamParser } from '@codemirror/language';
import { yaml as yamlMode } from '@codemirror/legacy-modes/mode/yaml';
import { protobuf as protobufMode } from '@codemirror/legacy-modes/mode/protobuf';
import { graphql as graphqlMode } from 'codemirror-graphql/cm6-legacy/mode';
import {
  endpointProtocol,
  type WorkloadEndpoint,
} from '@openchoreo/backstage-plugin-common';
import {
  useChoreoTokens,
  EditRowActions,
} from '@openchoreo/backstage-design-system';

const useStyles = makeStyles((theme: Theme) => ({
  container: {
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 6,
    marginBottom: theme.spacing(1),
    backgroundColor: theme.palette.background.default,
  },
  // Read-only row: content + inline actions share one line.
  readOnlyContainer: {
    display: 'flex',
    alignItems: 'center',
  },
  containerEditing: {
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.primary.main}`,
    borderRadius: 6,
    marginBottom: theme.spacing(1),
    backgroundColor: theme.palette.background.default,
    boxShadow: `0 0 0 1px ${theme.palette.primary.main}`,
  },
  header: {
    marginBottom: theme.spacing(1.5),
    paddingBottom: theme.spacing(1.5),
    borderBottom: `1px dashed ${theme.palette.divider}`,
  },
  details: {
    marginTop: theme.spacing(1),
    paddingTop: theme.spacing(1),
    borderTop: `1px dashed ${theme.palette.divider}`,
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
  fieldRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5),
  },
  nameInput: {
    flex: '1 1 200px',
    minWidth: 160,
  },
  protocolInput: {
    width: 140,
  },
  portInput: {
    width: 110,
  },
  schemaInput: {
    flex: '0 1 240px',
    minWidth: 200,
  },
  split: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  splitMain: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    paddingRight: theme.spacing(3),
    [theme.breakpoints.down('sm')]: {
      paddingRight: 0,
    },
  },
  pair: {
    display: 'flex',
    gap: theme.spacing(1.5),
  },
  grow: {
    flex: 1,
    minWidth: 0,
  },
  // The details take the fields' height and scroll within it.
  splitSide: {
    position: 'relative',
    minHeight: 240,
    borderLeft: `1px solid ${theme.palette.divider}`,
    [theme.breakpoints.down('sm')]: {
      borderLeft: 'none',
      borderTop: `1px solid ${theme.palette.divider}`,
      marginTop: theme.spacing(2),
      minHeight: 0,
    },
  },
  splitSideScroll: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflowY: 'auto',
    padding: theme.spacing(0, 1, 0, 3),
    [theme.breakpoints.down('sm')]: {
      position: 'static',
      maxHeight: 400,
      padding: theme.spacing(2, 0, 0),
    },
  },
  visibilityFieldset: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 4,
    padding: theme.spacing(0.5, 1),
    margin: 0,
    marginBottom: theme.spacing(0.5),
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

const ENDPOINT_TYPE_TO_SCHEMA_TYPE: Record<string, string> = {
  HTTP: 'openapi',
  gRPC: 'grpc',
  GraphQL: 'graphql',
  Websocket: 'asyncapi',
};

const SCHEMA_REQUIRED_TYPES = new Set(['gRPC']);

/**
 * The field changes that set a workload endpoint's protocol: the deprecated
 * type written alongside, so readers of either field agree (the API keeps
 * the two equal), and the protocol's schema format when it has one.
 */
export function endpointProtocolChanges(
  endpoint: WorkloadEndpoint,
  protocol: string,
): Array<[keyof WorkloadEndpoint, unknown]> {
  const changes: Array<[keyof WorkloadEndpoint, unknown]> = [
    ['protocol', protocol],
    ['type', protocol],
  ];
  const schemaType = ENDPOINT_TYPE_TO_SCHEMA_TYPE[protocol];
  if (schemaType) {
    changes.push(['schema', { ...endpoint.schema, type: schemaType }]);
  }
  return changes;
}

const SCHEMA_TYPE_DISPLAY_NAMES: Record<string, string> = {
  openapi: 'OpenAPI',
  asyncapi: 'AsyncAPI',
  grpc: 'Protobuf',
  graphql: 'GraphQL',
};

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
  alwaysSelected?: boolean;
}> = [
  { value: 'project', label: VISIBILITY_LABELS.project, alwaysSelected: true },
  { value: 'namespace', label: VISIBILITY_LABELS.namespace },
  { value: 'internal', label: VISIBILITY_LABELS.internal },
  { value: 'external', label: VISIBILITY_LABELS.external },
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
  const tokens = useChoreoTokens();
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
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="endpoint-editor-dialog-title"
    >
      <DialogTitle id="endpoint-editor-dialog-title">
        Edit Schema Content
      </DialogTitle>
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
            theme={tokens.editor.codeMirrorTheme}
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
  /**
   * Extra content shown inside the endpoint's card (for example how the
   * endpoint is exposed): under the summary in read-only mode, and under the
   * schema content field while editing.
   */
  details?: ReactNode;
  /**
   * When set, visibilities beyond project cannot be added and this reason is
   * shown under the visibility field; ones already selected can still be
   * cleared.
   */
  visibilityDisabledReason?: string;
  /** Shown as an error under the visibility field, e.g. a missing choice. */
  visibilityError?: string;
  /**
   * Content shown at the top of the edit form, above the name (for example
   * how the endpoint is exposed, which decides the fields below it).
   */
  header?: ReactNode;
  /** The protocols the endpoint can take; every protocol when unset. */
  protocolOptions?: readonly string[];
  /**
   * Lets project visibility be chosen like the others instead of being fixed
   * and always on.
   */
  projectVisibilitySelectable?: boolean;
  /**
   * Shows the details beside the fields while editing, in a half of their
   * own that scrolls, instead of under them.
   */
  detailsBeside?: boolean;
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
  details,
  visibilityDisabledReason,
  visibilityError,
  header,
  protocolOptions,
  projectVisibilitySelectable,
  detailsBeside,
}) => {
  const classes = useStyles();
  const fieldId = `endpoint-${useId().replace(/:/g, '')}`;
  const [schemaDialogOpen, setSchemaDialogOpen] = useState(false);

  const protocol = endpointProtocol(endpoint) || 'HTTP';
  const isSchemaRequired = SCHEMA_REQUIRED_TYPES.has(protocol);
  const schemaType = ENDPOINT_TYPE_TO_SCHEMA_TYPE[protocol];
  const schemaDisplayName = schemaType
    ? SCHEMA_TYPE_DISPLAY_NAMES[schemaType]
    : undefined;

  // Read-only display
  if (!isEditing) {
    const row = (
      <Box
        className={
          details
            ? classes.readOnlyContainer
            : className || `${classes.container} ${classes.readOnlyContainer}`
        }
      >
        <Box flex={1} className={classes.readOnlyContent}>
          <Typography className={classes.readOnlyName}>
            {endpointName || '(no name)'}
          </Typography>
          <Typography className={classes.readOnlyDetails}>
            {protocol} : {endpoint.port}
            {(() => {
              const vis = endpoint.visibility ?? [];
              const displayVis =
                vis.includes('project') || projectVisibilitySelectable
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
        <EditRowActions
          isEditing={false}
          itemLabel="endpoint"
          onEdit={onEdit}
          onApply={onApply}
          onCancel={onCancel ?? (() => {})}
          onRemove={onRemove}
          disabled={disabled}
          editDisabled={editDisabled}
          deleteDisabled={deleteDisabled}
        />
      </Box>
    );
    if (!details) {
      return row;
    }
    return (
      <Box className={className || classes.container}>
        {row}
        <Box className={classes.details}>{details}</Box>
      </Box>
    );
  }

  // Edit mode: name, protocol, port and schema on one row, each sized to
  // what it holds, then visibility.
  const protocols: readonly string[] = protocolOptions ?? PROTOCOL_TYPES;
  const schemaContent = endpoint.schema?.content?.trim() ?? '';
  const schemaLines = schemaContent ? schemaContent.split('\n').length : 0;
  const schemaMissing = isSchemaRequired && !schemaContent;
  const schemaSummary = schemaContent
    ? `${schemaDisplayName ?? 'Schema'} · ${schemaLines} ${
        schemaLines === 1 ? 'line' : 'lines'
      }`
    : '';
  const schemaPlaceholder = `${schemaDisplayName ?? 'Schema'} (${
    isSchemaRequired ? 'required' : 'optional'
  })`;
  // Beside its details (e.g. an Endpoint type's parameters), the form is two
  // halves split by a line: the endpoint's own fields stacked on the left,
  // the details on the right, scrolling within the left half's height.
  const besideDetails = !!detailsBeside && !!details;
  const nameField = (
    <TextField
      id={`${fieldId}-name`}
      label="Name"
      value={endpointName || ''}
      onChange={e => onNameChange(e.target.value)}
      variant="outlined"
      size="small"
      disabled={disabled}
      className={besideDetails ? undefined : classes.nameInput}
      fullWidth={besideDetails}
    />
  );
  const protocolField = (
    <FormControl
      variant="outlined"
      size="small"
      className={besideDetails ? classes.grow : classes.protocolInput}
    >
      <InputLabel id={`${fieldId}-protocol`}>Protocol</InputLabel>
      <Select
        labelId={`${fieldId}-protocol`}
        value={protocol}
        onChange={e => {
          for (const [field, value] of endpointProtocolChanges(
            endpoint,
            e.target.value as string,
          )) {
            onChange(field, value);
          }
        }}
        label="Protocol"
        // One protocol leaves nothing to choose.
        disabled={disabled || protocols.length <= 1}
      >
        {protocols.map(type => (
          <MenuItem key={type} value={type}>
            {type}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
  const portField = (
    <TextField
      id={`${fieldId}-port`}
      label="Port"
      type="number"
      value={endpoint.port || ''}
      onChange={e => onChange('port', parseInt(e.target.value, 10) || 0)}
      variant="outlined"
      size="small"
      disabled={disabled}
      inputProps={{ min: 1, max: 65535 }}
      className={besideDetails ? classes.grow : classes.portInput}
    />
  );
  const schemaField = (
    <TextField
      id={`${fieldId}-schema`}
      label="Schema"
      value={schemaSummary}
      placeholder={schemaPlaceholder}
      variant="outlined"
      size="small"
      error={schemaMissing}
      helperText={schemaMissing ? 'Required' : undefined}
      className={besideDetails ? undefined : classes.schemaInput}
      fullWidth={besideDetails}
      InputLabelProps={{ shrink: true }}
      InputProps={{
        readOnly: true,
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              size="small"
              edge="end"
              onClick={() => setSchemaDialogOpen(true)}
              disabled={disabled}
              aria-label="Edit schema"
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  );
  const visibilityField = (
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
          // Project is fixed and always on, unless the endpoint lets
          // it be chosen like the others.
          const fixed = !!opt.alwaysSelected && !projectVisibilitySelectable;
          const isChecked =
            fixed || (currentVisibility as string[]).includes(opt.value);
          const blocked = !!visibilityDisabledReason && !isChecked;
          return (
            <FormControlLabel
              key={opt.value}
              control={
                <Checkbox
                  checked={isChecked}
                  onChange={() => {
                    if (fixed) return;
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
              disabled={disabled || fixed || blocked}
            />
          );
        })}
      </FormGroup>
      {visibilityDisabledReason && (
        <Typography variant="caption" color="textSecondary">
          {visibilityDisabledReason}
        </Typography>
      )}
      {visibilityError && (
        <Typography variant="caption" color="error">
          {visibilityError}
        </Typography>
      )}
    </FormControl>
  );
  const schemaDialog = (
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
  );
  const actions = (
    <EditRowActions
      isEditing
      itemLabel="endpoint"
      onEdit={onEdit}
      onApply={onApply}
      onCancel={onCancel ?? (() => {})}
      onRemove={onRemove}
      disabled={disabled}
      applyDisabled={applyDisabled}
      hideCancel={!onCancel}
    />
  );

  if (besideDetails) {
    return (
      <Box className={className || classes.containerEditing}>
        {header && <Box className={classes.header}>{header}</Box>}
        <Box className={classes.split}>
          <Box className={classes.splitMain}>
            {nameField}
            <Box className={classes.pair}>
              {protocolField}
              {portField}
            </Box>
            {schemaField}
            {visibilityField}
          </Box>
          <Box className={classes.splitSide}>
            <Box className={classes.splitSideScroll}>{details}</Box>
          </Box>
        </Box>
        {schemaDialog}
        {actions}
      </Box>
    );
  }

  return (
    <Box className={className || classes.containerEditing}>
      {header && <Box className={classes.header}>{header}</Box>}
      <Box className={classes.fieldRow}>
        {nameField}
        {protocolField}
        {portField}
        {schemaField}
      </Box>
      {visibilityField}
      {schemaDialog}
      {details && <Box className={classes.details}>{details}</Box>}
      {actions}
    </Box>
  );
};
