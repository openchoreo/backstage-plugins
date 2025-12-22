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
import type { Connection } from '@openchoreo/backstage-plugin-common';

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

export interface ConnectionTypeOption {
  value: string;
  label: string;
}

export interface ProjectOption {
  name: string;
}

export interface ComponentOption {
  name: string;
  projectName: string;
}

export interface EndpointOption {
  name: string;
}

export interface ConnectionEditorProps {
  /** The connection name */
  connectionName: string;
  /** The connection to edit */
  connection: Connection;
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
  /** Available connection types */
  connectionTypes: ConnectionTypeOption[];
  /** Available projects */
  projects: ProjectOption[];
  /** Available components (filtered by selected project) */
  components: ComponentOption[];
  /** Available endpoints (filtered by selected component) */
  endpoints: EndpointOption[];
  /** Callback when connection type changes */
  onTypeChange: (type: string) => void;
  /** Callback when project changes */
  onProjectChange: (projectName: string) => void;
  /** Callback when component changes */
  onComponentChange: (componentName: string) => void;
  /** Callback when endpoint changes */
  onEndpointChange: (endpoint: string) => void;
  /** Callback when the connection name changes */
  onNameChange: (name: string) => void;
  /** Callback when the connection should be removed */
  onRemove: () => void;
}

/**
 * Editor component for a single connection.
 * Has two visual states: read-only (displays values) and edit mode (input fields).
 */
export const ConnectionEditor: FC<ConnectionEditorProps> = ({
  connectionName,
  connection,
  disabled = false,
  className,
  isEditing,
  onEdit,
  onApply,
  onCancel,
  editDisabled = false,
  deleteDisabled = false,
  connectionTypes,
  projects,
  components,
  endpoints,
  onTypeChange,
  onProjectChange,
  onComponentChange,
  onEndpointChange,
  onNameChange,
  onRemove,
}) => {
  const classes = useStyles();

  const formatConnectionSummary = () => {
    const parts = [];
    if (connection.type) parts.push(connection.type);
    if (connection.params?.projectName)
      parts.push(connection.params.projectName);
    if (connection.params?.componentName)
      parts.push(connection.params.componentName);
    if (connection.params?.endpoint) parts.push(connection.params.endpoint);
    return parts.join(' → ') || '(not configured)';
  };

  // Read-only display
  if (!isEditing) {
    return (
      <Box className={className || classes.container}>
        <Box display="flex" alignItems="center">
          <Box flex={1} className={classes.readOnlyContent}>
            <Typography className={classes.readOnlyName}>
              {connectionName || '(no name)'}
            </Typography>
            <Typography className={classes.readOnlyDetails}>
              {formatConnectionSummary()}
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
            aria-label="Remove connection"
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
            label="Connection Name"
            value={connectionName || ''}
            onChange={e => onNameChange(e.target.value)}
            fullWidth
            variant="outlined"
            size="small"
            disabled={disabled}
            className={classes.nameField}
          />
          <Grid container spacing={1}>
            <Grid item xs={12}>
              <FormControl fullWidth variant="outlined" size="small">
                <InputLabel>Connection Type</InputLabel>
                <Select
                  value={connection.type || ''}
                  onChange={e => onTypeChange(e.target.value as string)}
                  label="Connection Type"
                  disabled={disabled}
                >
                  {connectionTypes.map(type => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth variant="outlined" size="small">
                <InputLabel>Project</InputLabel>
                <Select
                  value={connection.params?.projectName || ''}
                  onChange={e => onProjectChange(e.target.value as string)}
                  label="Project"
                  disabled={disabled}
                >
                  {projects.map(project => (
                    <MenuItem key={project.name} value={project.name}>
                      {project.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth variant="outlined" size="small">
                <InputLabel>Component</InputLabel>
                <Select
                  value={connection.params?.componentName || ''}
                  onChange={e => onComponentChange(e.target.value as string)}
                  label="Component"
                  disabled={disabled || !connection.params?.projectName}
                >
                  {components.map(component => (
                    <MenuItem key={component.name} value={component.name}>
                      {component.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth variant="outlined" size="small">
                <InputLabel>Endpoint</InputLabel>
                <Select
                  value={connection.params?.endpoint || ''}
                  onChange={e => onEndpointChange(e.target.value as string)}
                  label="Endpoint"
                  disabled={disabled || !connection.params?.componentName}
                >
                  {endpoints.map(endpoint => (
                    <MenuItem key={endpoint.name} value={endpoint.name}>
                      {endpoint.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
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
            aria-label="Remove connection"
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
};
