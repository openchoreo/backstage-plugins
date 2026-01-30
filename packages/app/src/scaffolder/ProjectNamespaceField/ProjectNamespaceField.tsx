import { useEffect, useState, useCallback } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import {
  Grid,
  TextField,
  MenuItem,
  CircularProgress,
  Divider,
  InputAdornment,
} from '@material-ui/core';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';

export interface ProjectNamespaceData {
  project_name: string;
  namespace_name: string;
}

/**
 * Schema for the Project Namespace Field
 */
export const ProjectNamespaceFieldSchema = {
  returnValue: {
    type: 'object' as const,
    properties: {
      project_name: { type: 'string' as const },
      namespace_name: { type: 'string' as const },
    },
  },
};

/**
 * ProjectNamespaceField component
 * Two-column layout for Namespace and Project selection.
 * Namespace is displayed first (left), Project second (right).
 * Auto-selects the first available project on load.
 */
export const ProjectNamespaceField = ({
  onChange,
  formData,
  uiSchema,
  rawErrors,
}: FieldExtensionComponentProps<ProjectNamespaceData>) => {
  const catalogApi = useApi(catalogApiRef);

  const [projects, setProjects] = useState<
    Array<{ name: string; entityRef: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get default namespace from ui:options
  const defaultNamespace =
    typeof uiSchema?.['ui:options']?.defaultNamespace === 'string'
      ? uiSchema['ui:options'].defaultNamespace
      : '';

  // Current values
  const projectName = formData?.project_name || '';
  const namespaceName = formData?.namespace_name || defaultNamespace;

  // Fetch available projects (Systems) on mount
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { items } = await catalogApi.getEntities({
        filter: {
          kind: 'System',
        },
      });

      const projectList = items.map(entity => ({
        name: entity.metadata.name,
        entityRef: `system:${entity.metadata.namespace || 'default'}/${
          entity.metadata.name
        }`,
      }));

      setProjects(projectList);

      // Auto-select first project if none selected and projects available
      if (projectList.length > 0 && !formData?.project_name) {
        onChange({
          project_name: projectList[0].entityRef,
          namespace_name: namespaceName,
        });
      }
    } catch (err) {
      setError(`Failed to fetch projects: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [catalogApi, formData?.project_name, namespaceName, onChange]);

  useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle project selection change
  const handleProjectChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newProjectName = event.target.value;
    onChange({
      project_name: newProjectName,
      namespace_name: namespaceName,
    });
  };

  // Check if there are errors for specific fields
  const hasProjectError =
    rawErrors?.some(e => e.toLowerCase().includes('project')) || false;

  return (
    <>
      <Grid container spacing={2}>
        {/* Namespace Display (disabled) - FIRST (left) */}
        <Grid item xs={12} sm={6}>
          <TextField
            label="Namespace"
            value={namespaceName}
            disabled
            fullWidth
            variant="outlined"
            helperText="Auto selected based on Component Type"
          />
        </Grid>

        {/* Project Picker - SECOND (right), with outlined style */}
        <Grid item xs={12} sm={6}>
          <TextField
            select
            label="Project"
            value={projectName}
            onChange={handleProjectChange}
            disabled={loading}
            fullWidth
            variant="outlined"
            required
            error={hasProjectError}
            helperText={error || 'Select the project for this component'}
            InputProps={{
              endAdornment: loading ? (
                <InputAdornment position="end">
                  <CircularProgress size={20} />
                </InputAdornment>
              ) : undefined,
            }}
          >
            {projects.map(project => (
              <MenuItem key={project.entityRef} value={project.entityRef}>
                {project.name}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
      </Grid>

      {/* Separator after Namespace & Project */}
      <Divider style={{ marginTop: 24, marginBottom: 8 }} />
    </>
  );
};

/**
 * Validation function for project namespace field
 */
export const projectNamespaceFieldValidation = (
  value: ProjectNamespaceData,
  validation: any,
) => {
  if (!value?.project_name || value.project_name.trim() === '') {
    validation.addError('Project is required');
  }
  if (!value?.namespace_name || value.namespace_name.trim() === '') {
    validation.addError('Namespace is required');
  }
};
