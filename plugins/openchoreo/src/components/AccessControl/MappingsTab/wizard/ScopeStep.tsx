import {
  Box,
  Typography,
  TextField,
  Radio,
  RadioGroup,
  FormControlLabel,
  CircularProgress,
} from '@material-ui/core';
import { Autocomplete } from '@material-ui/lab';
import { makeStyles } from '@material-ui/core/styles';
import { WizardState } from './types';
import { useNamespaces, useProjects, useComponents } from '../../hooks';
import type { NamespaceSummary } from '../../../../api/OpenChoreoClientApi';
import { NotificationBanner } from '@openchoreo/backstage-plugin-react';

const useStyles = makeStyles(theme => ({
  root: {
    minHeight: 350,
  },
  title: {
    marginBottom: theme.spacing(2),
  },
  subtitle: {
    marginBottom: theme.spacing(3),
    color: theme.palette.text.secondary,
  },
  scopeTypeSection: {
    marginBottom: theme.spacing(3),
  },
  scopeTypeLabel: {
    fontWeight: 500,
    marginBottom: theme.spacing(1),
  },
  hierarchySection: {
    maxHeight: 280,
    overflowY: 'auto',
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
  },
  fieldGroup: {
    marginBottom: theme.spacing(2),
    '&:last-child': {
      marginBottom: 0,
    },
  },
  fieldLabel: {
    marginBottom: theme.spacing(0.5),
    fontWeight: 500,
    fontSize: '0.875rem',
  },
  fieldHint: {
    color: theme.palette.text.secondary,
    fontSize: '0.75rem',
    marginTop: theme.spacing(0.5),
  },
  scopeSummary: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(1.5),
    backgroundColor: theme.palette.info.light,
    borderRadius: theme.shape.borderRadius,
  },
  scopeSummaryText: {
    color: theme.palette.info.contrastText,
    fontSize: '0.875rem',
    fontFamily: 'monospace',
  },
}));

interface ScopeStepProps {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}

export const ScopeStep = ({ state, onChange }: ScopeStepProps) => {
  const classes = useStyles();

  // Hierarchy data hooks
  const { namespaces, loading: namespacesLoading } = useNamespaces();
  const { projects, loading: projectsLoading } = useProjects(
    state.namespace || undefined,
  );
  const { components, loading: componentsLoading } = useComponents(
    state.namespace || undefined,
    state.project || undefined,
  );

  const handleScopeTypeChange = (scopeType: 'global' | 'specific') => {
    onChange({
      scopeType,
      // Reset hierarchy when switching to global
      ...(scopeType === 'global' && {
        namespace: '',
        namespaceUnits: [],
        project: '',
        component: '',
      }),
    });
  };

  const handleNamespaceChange = (value: string | null) => {
    onChange({
      namespace: value || '',
      project: '',
      component: '',
    });
  };

  const handleProjectChange = (value: string | null) => {
    onChange({
      project: value || '',
      component: '',
    });
  };

  const handleComponentChange = (value: string | null) => {
    onChange({ component: value || '' });
  };

  const getScopePath = (): string => {
    if (state.scopeType === 'global') {
      return '*';
    }

    const parts: string[] = [];
    if (state.namespace) parts.push(state.namespace);
    if (state.project) parts.push(state.project);
    if (state.component) {
      parts.push(state.component);
    } else if (state.project) {
      parts.push('*');
    }

    return parts.join('/') || '*';
  };

  return (
    <Box className={classes.root}>
      <Typography variant="h6" className={classes.title}>
        Where should this role apply?
      </Typography>

      <Typography variant="body2" className={classes.subtitle}>
        Define the scope of resources this mapping affects
      </Typography>

      <Box className={classes.scopeTypeSection}>
        <RadioGroup
          value={state.scopeType}
          onChange={e =>
            handleScopeTypeChange(e.target.value as 'global' | 'specific')
          }
        >
          <FormControlLabel
            value="global"
            control={<Radio color="primary" size="small" />}
            label="Everywhere (global scope)"
          />
          <FormControlLabel
            value="specific"
            control={<Radio color="primary" size="small" />}
            label="Specific scope (namespace, project, or component)"
          />
        </RadioGroup>
      </Box>

      {state.scopeType === 'specific' && (
        <Box className={classes.hierarchySection}>
          <Box className={classes.fieldGroup}>
            <Typography className={classes.fieldLabel}>Namespace</Typography>
            <Autocomplete
              freeSolo
              options={namespaces.map((ns: NamespaceSummary) => ns.name)}
              value={state.namespace}
              onChange={(_, value) => handleNamespaceChange(value)}
              onInputChange={(_, value, reason) => {
                if (reason === 'input') {
                  handleNamespaceChange(value);
                }
              }}
              loading={namespacesLoading}
              renderInput={params => (
                <TextField
                  {...params}
                  variant="outlined"
                  size="small"
                  placeholder="Select or type namespace"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {namespacesLoading && (
                          <CircularProgress color="inherit" size={20} />
                        )}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </Box>

          <Box className={classes.fieldGroup}>
            <Typography className={classes.fieldLabel}>Project</Typography>
            <Typography className={classes.fieldHint}>
              {state.namespace
                ? 'Leave empty to apply to all projects'
                : 'Select a namespace first'}
            </Typography>
            <Autocomplete
              freeSolo
              options={projects.map(p => p.name)}
              value={state.project}
              onChange={(_, value) => handleProjectChange(value)}
              onInputChange={(_, value, reason) => {
                if (reason === 'input') {
                  handleProjectChange(value);
                }
              }}
              disabled={!state.namespace}
              loading={projectsLoading}
              renderInput={params => (
                <TextField
                  {...params}
                  variant="outlined"
                  size="small"
                  placeholder={state.namespace ? 'Select or type project' : ''}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {projectsLoading && (
                          <CircularProgress color="inherit" size={20} />
                        )}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </Box>

          <Box className={classes.fieldGroup}>
            <Typography className={classes.fieldLabel}>Component</Typography>
            <Typography className={classes.fieldHint}>
              {state.project
                ? 'Leave empty to apply to all components'
                : 'Select a project first'}
            </Typography>
            <Autocomplete
              freeSolo
              options={components.map(c => c.name)}
              value={state.component}
              onChange={(_, value) => handleComponentChange(value)}
              onInputChange={(_, value, reason) => {
                if (reason === 'input') {
                  handleComponentChange(value);
                }
              }}
              disabled={!state.project}
              loading={componentsLoading}
              renderInput={params => (
                <TextField
                  {...params}
                  variant="outlined"
                  size="small"
                  placeholder={state.project ? 'Select or type component' : ''}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {componentsLoading && (
                          <CircularProgress color="inherit" size={20} />
                        )}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </Box>
        </Box>
      )}

      <NotificationBanner
        variant="info"
        showIcon
        message={<Typography>Scope: {getScopePath()}</Typography>}
      />
    </Box>
  );
};
