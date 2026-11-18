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
  Box,
  Typography,
  Button,
  Chip,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';
import CheckIcon from '@material-ui/icons/Check';
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
  // The edit form keeps a readable width on wide screens.
  form: {
    maxWidth: 760,
  },
  fieldRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5),
  },
  nameInput: {
    flex: '1 1 220px',
  },
  protocolInput: {
    width: 150,
  },
  portInput: {
    width: 110,
  },
  line: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  lineLabel: {
    width: 80,
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: theme.palette.text.secondary,
  },
  // Notes under a line align with its content, past the label.
  lineNote: {
    flexBasis: '100%',
    paddingLeft: 80 + theme.spacing(1),
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.75),
  },
  fixedChip: {
    cursor: 'default',
  },
  schemaStatus: {
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
  },
  schemaMissing: {
    fontSize: '0.875rem',
    color: theme.palette.error.main,
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
  /** Leaves the visibility field out, e.g. for an endpoint kept in its project. */
  hideVisibility?: boolean;
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
  hideVisibility,
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

  // Edit mode: how the endpoint is exposed (the header) first, then name,
  // protocol and port on one row, then visibility and schema as labelled
  // lines. Fields keep sensible widths instead of stretching across the card.
  const protocols: readonly string[] = protocolOptions ?? PROTOCOL_TYPES;
  const visibility = (endpoint.visibility ?? []) as string[];
  const schemaContent = endpoint.schema?.content?.trim() ?? '';
  const schemaLines = schemaContent ? schemaContent.split('\n').length : 0;
  const schemaMissing = isSchemaRequired && !schemaContent;
  let schemaStatus = 'not set';
  if (schemaContent) {
    schemaStatus = `${schemaLines} ${schemaLines === 1 ? 'line' : 'lines'}`;
  } else if (schemaMissing) {
    schemaStatus = 'required';
  }

  const toggleVisibility = (value: string) => {
    onChange(
      'visibility',
      visibility.includes(value)
        ? visibility.filter(v => v !== value)
        : [...visibility, value],
    );
  };

  return (
    <Box className={className || classes.containerEditing}>
      <Box className={classes.form}>
        {header && <Box className={classes.header}>{header}</Box>}
        <Box className={classes.fieldRow}>
          <TextField
            label="Name"
            value={endpointName || ''}
            onChange={e => onNameChange(e.target.value)}
            variant="outlined"
            size="small"
            disabled={disabled}
            className={classes.nameInput}
          />
          {protocols.length > 1 ? (
            <TextField
              select
              id={`${fieldId}-protocol`}
              label="Protocol"
              value={protocol}
              onChange={e => {
                for (const [field, value] of endpointProtocolChanges(
                  endpoint,
                  e.target.value as string,
                )) {
                  onChange(field, value);
                }
              }}
              variant="outlined"
              size="small"
              disabled={disabled}
              className={classes.protocolInput}
            >
              {protocols.map(type => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            // One protocol leaves nothing to choose.
            <TextField
              label="Protocol"
              value={protocol}
              variant="outlined"
              size="small"
              InputProps={{ readOnly: true }}
              className={classes.protocolInput}
            />
          )}
          <TextField
            label="Port"
            type="number"
            value={endpoint.port || ''}
            onChange={e => onChange('port', parseInt(e.target.value, 10) || 0)}
            variant="outlined"
            size="small"
            disabled={disabled}
            inputProps={{ min: 1, max: 65535 }}
            className={classes.portInput}
          />
        </Box>
        {!hideVisibility && (
          <Box className={classes.line}>
            <Typography className={classes.lineLabel} id={`${fieldId}-vis`}>
              Visibility
            </Typography>
            <Box
              className={classes.chips}
              role="group"
              aria-labelledby={`${fieldId}-vis`}
            >
              {VISIBILITY_OPTIONS.map(opt => {
                const selected =
                  !!opt.alwaysSelected || visibility.includes(opt.value);
                if (opt.alwaysSelected) {
                  // Project is always included and can't be removed.
                  return (
                    <Chip
                      key={opt.value}
                      label={opt.label}
                      size="small"
                      color="primary"
                      icon={<CheckIcon />}
                      className={classes.fixedChip}
                    />
                  );
                }
                const blocked =
                  disabled || (!!visibilityDisabledReason && !selected);
                return (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    size="small"
                    color={selected ? 'primary' : 'default'}
                    variant={selected ? 'default' : 'outlined'}
                    icon={selected ? <CheckIcon /> : undefined}
                    clickable
                    disabled={blocked}
                    aria-pressed={selected}
                    aria-disabled={blocked}
                    onClick={() => {
                      if (!blocked) toggleVisibility(opt.value);
                    }}
                  />
                );
              })}
            </Box>
            {visibilityDisabledReason && (
              <Typography
                variant="caption"
                color="textSecondary"
                className={classes.lineNote}
              >
                {visibilityDisabledReason}
              </Typography>
            )}
            {visibilityError && (
              <Typography
                variant="caption"
                color="error"
                className={classes.lineNote}
              >
                {visibilityError}
              </Typography>
            )}
          </Box>
        )}
        <Box className={classes.line}>
          <Typography className={classes.lineLabel}>Schema</Typography>
          <Typography
            className={
              schemaMissing ? classes.schemaMissing : classes.schemaStatus
            }
          >
            {schemaDisplayName ? `${schemaDisplayName} · ` : ''}
            {schemaStatus}
          </Typography>
          <Button
            size="small"
            color="primary"
            onClick={() => setSchemaDialogOpen(true)}
            disabled={disabled}
          >
            {schemaContent ? 'Edit schema' : 'Add schema'}
          </Button>
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
        </Box>
        {details && <Box className={classes.details}>{details}</Box>}
      </Box>
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
    </Box>
  );
};
