import type { FC } from 'react';
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
  InputLabel,
} from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';
import DeleteIcon from '@material-ui/icons/Delete';
import EditIcon from '@material-ui/icons/Edit';
import CheckIcon from '@material-ui/icons/Check';
import CloseIcon from '@material-ui/icons/Close';
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
}));

const PROTOCOL_TYPES = [
  'TCP',
  'UDP',
  'HTTP',
  'REST',
  'gRPC',
  'Websocket',
  'GraphQL',
] as const;

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
  onChange,
  onNameChange,
  onRemove,
}) => {
  const classes = useStyles();

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
                  onChange={e => onChange('type', e.target.value)}
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
            <Grid item xs={6}>
              <TextField
                label="Schema Type"
                value={endpoint.schema?.type || ''}
                onChange={e =>
                  onChange('schema', {
                    ...endpoint.schema,
                    type: e.target.value,
                  })
                }
                fullWidth
                variant="outlined"
                size="small"
                disabled={disabled}
                placeholder="e.g., REST, GraphQL"
                helperText="Optional"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Schema Content"
                value={endpoint.schema?.content || ''}
                onChange={e =>
                  onChange('schema', {
                    ...endpoint.schema,
                    content: e.target.value,
                  })
                }
                fullWidth
                variant="outlined"
                size="small"
                disabled={disabled}
                placeholder="Schema definition"
                helperText="Optional"
              />
            </Grid>
          </Grid>
        </Box>
        <Box display="flex" flexDirection="column" ml={1}>
          <IconButton
            onClick={onApply}
            color="primary"
            size="small"
            disabled={disabled}
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
