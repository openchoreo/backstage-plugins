import type { FC } from 'react';
import {
  TextField,
  Grid,
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
} from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';
import { EditRowActions } from '@openchoreo/backstage-design-system';
import type { Dependency } from '@openchoreo/backstage-plugin-common';

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
    gap: theme.spacing(1),
  },
  typeChip: {
    height: 20,
    fontSize: '0.7rem',
  },
}));

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

export interface DependencyEditorProps {
  /** The dependency index */
  index: number;
  /** The dependency to edit */
  dependency: Dependency;
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
  /** Available projects */
  projects: ProjectOption[];
  /** Available components (filtered by selected project) */
  components: ComponentOption[];
  /** Available endpoints (filtered by selected component) */
  endpoints: EndpointOption[];
  /** Callback when project changes */
  onProjectChange: (projectName: string) => void;
  /** Callback when component changes */
  onComponentChange: (componentName: string) => void;
  /** Callback when endpoint changes */
  onEndpointChange: (endpoint: string) => void;
  /** Available visibility options based on target endpoint and relationship */
  availableVisibilities: ('project' | 'namespace')[];
  /** Callback when visibility changes */
  onVisibilityChange: (visibility: 'project' | 'namespace') => void;
  /** Callback when an env binding field changes */
  onEnvBindingChange: (field: string, value: string) => void;
  /** Callback when the dependency should be removed */
  onRemove: () => void;
}

/**
 * Editor component for a single dependency.
 * Has two visual states: read-only (displays values) and edit mode (input fields).
 */
export const DependencyEditor: FC<DependencyEditorProps> = ({
  dependency,
  disabled = false,
  className,
  isEditing,
  onEdit,
  onApply,
  onCancel,
  editDisabled = false,
  deleteDisabled = false,
  applyDisabled = false,
  projects,
  components,
  endpoints,
  onProjectChange,
  onComponentChange,
  onEndpointChange,
  availableVisibilities,
  onVisibilityChange,
  onEnvBindingChange,
  onRemove,
}) => {
  const classes = useStyles();

  const formatDependencySummary = () => {
    const parts = [];
    if (dependency.project) parts.push(dependency.project);
    if (dependency.component) parts.push(dependency.component);
    if (dependency.name) parts.push(dependency.name);
    if (dependency.visibility) parts.push(`[${dependency.visibility}]`);
    return parts.join(' → ') || '(not configured)';
  };

  // Read-only display
  if (!isEditing) {
    return (
      <Box className={className || classes.container}>
        <Box flex={1} className={classes.readOnlyContent}>
          <Typography className={classes.readOnlyName}>
            {dependency.component || '(no component)'}
          </Typography>
          <Chip
            label="Component"
            size="small"
            variant="outlined"
            className={classes.typeChip}
          />
          <Typography className={classes.readOnlyDetails}>
            {formatDependencySummary()}
          </Typography>
        </Box>
        <EditRowActions
          isEditing={false}
          itemLabel="dependency"
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
  }

  // Edit mode
  return (
    <Box className={className || classes.containerEditing}>
      <Grid container spacing={1}>
        <Grid item xs={6}>
          <FormControl fullWidth variant="outlined" size="small">
            <InputLabel>Project</InputLabel>
            <Select
              value={dependency.project || ''}
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
              value={dependency.component || ''}
              onChange={e => onComponentChange(e.target.value as string)}
              label="Component"
              disabled={disabled || !dependency.project}
            >
              {components.map(component => (
                <MenuItem key={component.name} value={component.name}>
                  {component.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6}>
          <FormControl fullWidth variant="outlined" size="small">
            <InputLabel>Endpoint</InputLabel>
            <Select
              value={dependency.name || ''}
              onChange={e => onEndpointChange(e.target.value as string)}
              label="Endpoint"
              disabled={disabled || !dependency.component}
            >
              {endpoints.map(endpoint => (
                <MenuItem key={endpoint.name} value={endpoint.name}>
                  {endpoint.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6}>
          <FormControl fullWidth variant="outlined" size="small">
            <InputLabel>Visibility</InputLabel>
            <Select
              value={
                dependency.visibility &&
                availableVisibilities.includes(dependency.visibility)
                  ? dependency.visibility
                  : ''
              }
              onChange={e =>
                onVisibilityChange(e.target.value as 'project' | 'namespace')
              }
              label="Visibility"
              disabled={disabled || availableVisibilities.length === 0}
            >
              {availableVisibilities.includes('project') && (
                <MenuItem value="project">Project</MenuItem>
              )}
              {availableVisibilities.includes('namespace') && (
                <MenuItem value="namespace">Namespace</MenuItem>
              )}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12}>
          <Typography variant="caption" color="textSecondary">
            Environment Variable Bindings
          </Typography>
        </Grid>
        <Grid item xs={6}>
          <TextField
            label="Address Env Var"
            value={dependency.envBindings?.address || ''}
            onChange={e => onEnvBindingChange('address', e.target.value)}
            fullWidth
            variant="outlined"
            size="small"
            disabled={disabled}
            placeholder="e.g. SVC_ADDRESS"
            helperText="Full connection string"
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            label="Host Env Var"
            value={dependency.envBindings?.host || ''}
            onChange={e => onEnvBindingChange('host', e.target.value)}
            fullWidth
            variant="outlined"
            size="small"
            disabled={disabled}
            placeholder="e.g. SVC_HOST"
            helperText="Hostname only"
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            label="Port Env Var"
            value={dependency.envBindings?.port || ''}
            onChange={e => onEnvBindingChange('port', e.target.value)}
            fullWidth
            variant="outlined"
            size="small"
            disabled={disabled}
            placeholder="e.g. SVC_PORT"
            helperText="Port number only"
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            label="Base Path Env Var"
            value={dependency.envBindings?.basePath || ''}
            onChange={e => onEnvBindingChange('basePath', e.target.value)}
            fullWidth
            variant="outlined"
            size="small"
            disabled={disabled}
            placeholder="e.g. SVC_BASE_PATH"
            helperText="Base path only"
          />
        </Grid>
      </Grid>
      <EditRowActions
        isEditing
        itemLabel="dependency"
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
