import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
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
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import {
  useComponentCreateContextPermission,
  type ComponentTypeContext,
} from '@openchoreo/backstage-plugin-react';
import { useScaffolderPreselection } from '../ScaffolderPreselectionContext';

// Bridges the async ABAC check to the sync validator: the field writes the
// latest denial here, projectNamespaceFieldValidation reads it on submit.
const lastAuthzDenialRef: {
  current: { namespace: string; project: string; reason: string } | undefined;
} = { current: undefined };

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
 *
 * Two modes:
 * - Fixed namespace: When defaultNamespace is provided (namespace-scoped CTDs),
 *   namespace is shown as a disabled field.
 * - Selectable namespace: When defaultNamespace is empty (cluster-scoped CTDs),
 *   namespace is a dropdown allowing the user to pick from available namespaces.
 *
 * Auto-selects the first available project on load.
 */
export const ProjectNamespaceField = ({
  onChange,
  formData,
  uiSchema,
  rawErrors,
}: FieldExtensionComponentProps<ProjectNamespaceData>) => {
  const catalogApi = useApi(catalogApiRef);
  const {
    preselectedProject,
    clearPreselectedProject,
    preselectedNamespace,
    clearPreselectedNamespace,
  } = useScaffolderPreselection();

  const [namespaces, setNamespaces] = useState<
    Array<{ name: string; displayName?: string }>
  >([]);
  const [projects, setProjects] = useState<
    Array<{ name: string; entityRef: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadingNamespaces, setLoadingNamespaces] = useState(false);
  const [namespaceError, setNamespaceError] = useState<string | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);

  // Track if we've already applied the preselection to avoid re-applying
  const preselectionAppliedRef = useRef(false);
  // Guard against out-of-order async project fetch responses
  const fetchProjectsRequestIdRef = useRef(0);

  // Get default namespace from ui:options
  const defaultNamespace =
    typeof uiSchema?.['ui:options']?.defaultNamespace === 'string'
      ? uiSchema['ui:options'].defaultNamespace
      : '';

  // Whether namespace is selectable (cluster-scoped templates have no defaultNamespace)
  const isNamespaceSelectable = !defaultNamespace;

  // Current values — fixed namespace always takes precedence over stale form state
  const projectName = formData?.project_name || '';
  const namespaceName = defaultNamespace || formData?.namespace_name || '';

  // Template ref from the URL — used to look up the CTD_NAME annotation.
  const routeParams = useParams<{
    namespace?: string;
    templateName?: string;
  }>();
  const templateNamespace = routeParams.namespace;
  const templateName = routeParams.templateName;

  const [componentTypeCtx, setComponentTypeCtx] = useState<
    ComponentTypeContext | undefined
  >(undefined);

  useEffect(() => {
    let cancelled = false;
    if (!templateName || !templateNamespace) {
      setComponentTypeCtx(undefined);
      return undefined;
    }
    const fetchTemplate = async () => {
      try {
        const tpl = await catalogApi.getEntityByRef({
          kind: 'Template',
          namespace: templateNamespace,
          name: templateName,
        });
        if (cancelled || !tpl) return;
        const ctdName = tpl.metadata.annotations?.[CHOREO_ANNOTATIONS.CTD_NAME];
        if (!ctdName) {
          // Non-component template — ABAC check doesn't apply.
          setComponentTypeCtx(undefined);
          return;
        }
        const ctdKind = tpl.metadata.annotations?.[CHOREO_ANNOTATIONS.CTD_KIND];
        setComponentTypeCtx({
          name: ctdName,
          ...(ctdKind ? { kind: ctdKind } : {}),
        });
      } catch {
        if (!cancelled) setComponentTypeCtx(undefined);
      }
    };
    fetchTemplate();
    return () => {
      cancelled = true;
    };
  }, [catalogApi, templateNamespace, templateName]);

  // Form holds an entityRef (`system:<ns>/<name>`); the backend wants the bare name.
  const bareProjectName = projectName.includes('/')
    ? projectName.split('/').pop() ?? ''
    : projectName;

  const { allowed: ctxAllowed, loading: ctxLoading } =
    useComponentCreateContextPermission({
      namespace: namespaceName || undefined,
      project: bareProjectName || undefined,
      componentType: componentTypeCtx,
    });

  // Sync the deny decision into the module ref so validate() can block submit.
  const authzCheckActive = Boolean(
    componentTypeCtx && namespaceName && bareProjectName,
  );
  const authzDenied = authzCheckActive && !ctxLoading && !ctxAllowed;
  const authzDeniedReason = authzDenied
    ? `You do not have permission to create a '${componentTypeCtx?.name}' component.`
    : undefined;

  useEffect(() => {
    if (authzDenied && componentTypeCtx) {
      lastAuthzDenialRef.current = {
        namespace: namespaceName,
        project: bareProjectName,
        reason:
          authzDeniedReason ??
          'You do not have permission to create this component.',
      };
    } else if (
      lastAuthzDenialRef.current &&
      lastAuthzDenialRef.current.namespace === namespaceName &&
      lastAuthzDenialRef.current.project === bareProjectName
    ) {
      // The currently-selected tuple is now allowed — clear the stale denial.
      lastAuthzDenialRef.current = undefined;
    }
  }, [
    authzDenied,
    namespaceName,
    bareProjectName,
    authzDeniedReason,
    componentTypeCtx,
  ]);

  // Fetch available namespaces (Domain entities) for cluster-scoped templates
  useEffect(() => {
    if (!isNamespaceSelectable) return undefined;

    let ignore = false;

    const fetchNamespaces = async () => {
      setLoadingNamespaces(true);

      try {
        const { items } = await catalogApi.getEntities({
          filter: { kind: 'Domain' },
        });

        // Filter out entities marked for deletion
        const activeItems = items.filter(
          entity =>
            !entity.metadata.annotations?.[
              CHOREO_ANNOTATIONS.DELETION_TIMESTAMP
            ],
        );

        const nsList = activeItems.map(entity => ({
          name: entity.metadata.name,
          displayName: entity.metadata.title || entity.metadata.name,
        }));

        if (!ignore) {
          setNamespaces(nsList);

          // Auto-select namespace: URL preselection > 'default' > first
          if (nsList.length > 0 && !namespaceName) {
            let selected = nsList[0];
            if (preselectedNamespace) {
              const match = nsList.find(ns => ns.name === preselectedNamespace);
              if (match) {
                selected = match;
                clearPreselectedNamespace();
              }
            }
            if (!preselectedNamespace) {
              const defaultNs = nsList.find(ns => ns.name === 'default');
              if (defaultNs) selected = defaultNs;
            }
            onChange({
              project_name: '',
              namespace_name: selected.name,
            });
          }
        }
      } catch (err) {
        if (!ignore) {
          setNamespaceError(`Failed to fetch namespaces: ${err}`);
        }
      } finally {
        if (!ignore) {
          setLoadingNamespaces(false);
        }
      }
    };

    fetchNamespaces();

    return () => {
      ignore = true;
    };
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNamespaceSelectable, catalogApi]);

  // Fetch available projects (Systems) when namespace changes
  const fetchProjects = useCallback(async () => {
    const requestId = ++fetchProjectsRequestIdRef.current;

    if (!namespaceName) {
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setProjectError(null);

    try {
      const { items } = await catalogApi.getEntities({
        filter: {
          kind: 'System',
          'metadata.annotations.openchoreo.io/namespace': namespaceName,
        },
      });

      // Bail if a newer request has been issued (namespace changed while fetching)
      if (requestId !== fetchProjectsRequestIdRef.current) return;

      // Filter out entities marked for deletion
      const activeItems = items.filter(
        entity =>
          !entity.metadata.annotations?.[CHOREO_ANNOTATIONS.DELETION_TIMESTAMP],
      );

      const projectList = activeItems.map(entity => ({
        name: entity.metadata.name,
        entityRef: `system:${entity.metadata.namespace || 'default'}/${
          entity.metadata.name
        }`,
      }));

      setProjects(projectList);

      // Clear stale selection when no projects exist
      if (projectList.length === 0) {
        if (formData?.project_name) {
          onChange({ project_name: '', namespace_name: namespaceName });
        }
        return;
      }

      // Check if current selection is still valid in the new project list
      const currentStillValid =
        formData?.project_name &&
        projectList.some(p => p.entityRef === formData.project_name);

      // Auto-select project: URL preselection > 'default' > first
      if (!currentStillValid) {
        let selectedProject: string | undefined;

        // Check if we have a preselected project from context
        if (preselectedProject && !preselectionAppliedRef.current) {
          const matchingProject = projectList.find(
            p =>
              p.name === preselectedProject ||
              p.entityRef.endsWith(`/${preselectedProject}`),
          );
          if (matchingProject) {
            selectedProject = matchingProject.entityRef;
            preselectionAppliedRef.current = true;
            clearPreselectedProject();
          }
        }

        // Fall back to 'default' project if available, otherwise first
        if (!selectedProject) {
          const defaultProject = projectList.find(p => p.name === 'default');
          selectedProject = (defaultProject ?? projectList[0]).entityRef;
        }

        onChange({
          project_name: selectedProject,
          namespace_name: namespaceName,
        });
      }
    } catch (err) {
      if (requestId === fetchProjectsRequestIdRef.current) {
        setProjectError(`Failed to fetch projects: ${err}`);
      }
    } finally {
      if (requestId === fetchProjectsRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [
    catalogApi,
    formData?.project_name,
    namespaceName,
    onChange,
    preselectedProject,
    clearPreselectedProject,
  ]);

  useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespaceName]);

  // Handle namespace selection change (cluster-scoped templates)
  const handleNamespaceChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const newNamespaceName = event.target.value;
    // Reset project when namespace changes
    onChange({
      project_name: '',
      namespace_name: newNamespaceName,
    });
  };

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
  const hasNamespaceError =
    rawErrors?.some(e => e.toLowerCase().includes('namespace')) || false;

  return (
    <>
      <Grid container spacing={2}>
        {/* Namespace - FIRST (left) */}
        <Grid item xs={12} sm={6}>
          {isNamespaceSelectable ? (
            <TextField
              select
              label="Namespace"
              value={namespaceName}
              onChange={handleNamespaceChange}
              disabled={loadingNamespaces}
              fullWidth
              variant="outlined"
              required
              error={hasNamespaceError || !!namespaceError}
              helperText={
                namespaceError || 'Select the namespace for this component'
              }
              InputProps={{
                endAdornment: loadingNamespaces ? (
                  <InputAdornment position="end">
                    <CircularProgress size={20} />
                  </InputAdornment>
                ) : undefined,
              }}
            >
              {namespaces.map(ns => (
                <MenuItem key={ns.name} value={ns.name}>
                  {ns.displayName || ns.name}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <TextField
              label="Namespace"
              value={namespaceName}
              disabled
              fullWidth
              variant="outlined"
              helperText="Auto selected based on Component Type"
            />
          )}
        </Grid>

        {/* Project Picker - SECOND (right), with outlined style */}
        <Grid item xs={12} sm={6}>
          <TextField
            select
            label="Project"
            value={projectName}
            onChange={handleProjectChange}
            disabled={loading || (isNamespaceSelectable && !namespaceName)}
            fullWidth
            variant="outlined"
            required
            error={hasProjectError || !!projectError || authzDenied}
            helperText={
              authzDeniedReason ||
              projectError ||
              'Select the project for this component'
            }
            InputProps={{
              endAdornment: loading ? (
                <InputAdornment position="end">
                  <CircularProgress size={20} />
                </InputAdornment>
              ) : undefined,
            }}
          >
            {!loading && projects.length === 0 && (
              <MenuItem disabled value="">
                No projects found in the selected namespace
              </MenuItem>
            )}
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
 * Sync validator. Also blocks submit when the current tuple matches the last
 * denial recorded in `lastAuthzDenialRef`.
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

  const denial = lastAuthzDenialRef.current;
  if (denial) {
    const formProjectBare = value?.project_name?.includes('/')
      ? value.project_name.split('/').pop() ?? ''
      : value?.project_name ?? '';
    const formNamespace = value?.namespace_name ?? '';
    if (
      formNamespace === denial.namespace &&
      formProjectBare === denial.project
    ) {
      validation.addError(denial.reason);
    }
  }
};
