import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dependency,
  ResourceDependency,
  ResourceTypeOutput,
  WorkloadEndpoint,
  WorkloadResource,
} from '@openchoreo/backstage-plugin-common';
import {
  DependencyList,
  useDependencyEditBuffer,
  type ProjectOption,
  type ComponentOption,
  type EndpointOption,
} from '@openchoreo/backstage-plugin-react';
import { catalogApiRef, useEntity } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../../api/OpenChoreoClientApi';
import { useWorkloadContext } from '../WorkloadContext';

interface DependencyContentProps {
  dependencies: Dependency[];
  /** Resource dependencies rendered with an inline editor. */
  resources?: ResourceDependency[];
  onDependencyReplace: (index: number, dependency: Dependency) => void;
  onAddDependency: () => number;
  onRemoveDependency: (index: number) => void;
  /** Resource dependency mutation handlers, mirrored from the endpoint side. */
  onResourceDependencyReplace?: (
    index: number,
    resource: ResourceDependency,
  ) => void;
  onAddResourceDependency?: (ref: string) => number;
  onRemoveResourceDependency?: (index: number) => void;
  disabled: boolean;
}

/** Cached endpoint data for a component, keyed by endpoint name */
type EndpointMap = { [endpointName: string]: WorkloadEndpoint };

export const DependencyContent: FC<DependencyContentProps> = ({
  dependencies,
  resources,
  onDependencyReplace,
  onAddDependency,
  onRemoveDependency,
  onResourceDependencyReplace,
  onAddResourceDependency,
  onRemoveResourceDependency,
  disabled,
}) => {
  const catalogApi = useApi(catalogApiRef);
  const client = useApi(openChoreoClientApiRef);
  const { entity: selectedEntity } = useEntity();
  const { setEditingSection } = useWorkloadContext();

  // Current entity's project and namespace
  const currentProject =
    selectedEntity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT] || '';
  const currentNamespace =
    selectedEntity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] || '';

  const [allComponents, setAllComponents] = useState<Entity[]>([]);
  const [endpointCache, setEndpointCache] = useState<{
    [key: string]: EndpointMap;
  }>({});
  // Resource entities owned by the current project. Drives the Add
  // Resource Dependency picker and lets the row editor resolve a ref to
  // its (Cluster)ResourceType for the outputs fetch.
  const [projectResources, setProjectResources] = useState<Entity[]>([]);
  // Outputs cache keyed by resource ref. Each entry is the declared
  // outputs[] of the resource's (Cluster)ResourceType; rendered by
  // ResourceDependencyEditor to drive the Add-binding dropdown and the
  // per-row kind chips.
  const [outputsByRef, setOutputsByRef] = useState<{
    [ref: string]: ResourceTypeOutput[];
  }>({});

  const editBuffer = useDependencyEditBuffer({
    dependencies,
    onDependencyReplace,
    onRemoveDependency,
    defaultProject: currentProject,
  });

  // Report editing state to context
  useEffect(() => {
    setEditingSection('dependencies', editBuffer.isAnyRowEditing);
  }, [editBuffer.isAnyRowEditing, setEditingSection]);

  // Fetch all components from catalog
  useEffect(() => {
    const fetchComponents = async () => {
      const entities = await catalogApi.getEntities();
      setAllComponents(
        entities.items?.filter(
          entity =>
            entity.kind === 'Component' &&
            !(
              entity.metadata.name === selectedEntity.metadata.name &&
              entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT] ===
                currentProject
            ),
        ) || [],
      );
    };
    fetchComponents();
  }, [catalogApi, selectedEntity, currentProject]);

  // Fetch Resource entities owned by the current project from the catalog.
  useEffect(() => {
    const fetchResources = async () => {
      const entities = await catalogApi.getEntities();
      setProjectResources(
        entities.items?.filter(
          entity =>
            entity.kind === 'Resource' &&
            entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT] ===
              currentProject,
        ) || [],
      );
    };
    fetchResources();
  }, [catalogApi, currentProject]);

  // Fetch outputs for each wired resource dep. Walks resources[], looks up
  // each ref's catalog Entity (for the RESOURCE_TYPE_KIND annotation), and
  // hits the BFF outputs endpoint. Results are cached by ref so flipping
  // between FORM and YAML modes doesn't re-fetch.
  useEffect(() => {
    if (!resources || resources.length === 0) return;
    if (projectResources.length === 0) return;

    const refsToFetch = resources
      .map(r => r.ref)
      .filter(ref => ref && !(ref in outputsByRef));

    refsToFetch.forEach(async ref => {
      const entity = projectResources.find(e => e.metadata.name === ref);
      if (!entity) return;
      try {
        const result = await client.fetchResourceTypeOutputs(entity);
        setOutputsByRef(prev => ({
          ...prev,
          [ref]: result.data ?? [],
        }));
      } catch {
        // Cache an empty array so we don't retry indefinitely; the editor
        // tolerates missing outputs (no kind chips, empty Add dropdown).
        setOutputsByRef(prev => ({ ...prev, [ref]: [] }));
      }
    });
  }, [resources, projectResources, outputsByRef, client]);

  // Get unique projects from all components
  const projectList: ProjectOption[] = useMemo(() => {
    const projects = new Set<string>();
    allComponents.forEach(component => {
      const projectName =
        component.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
      if (projectName) {
        projects.add(projectName);
      }
    });
    return Array.from(projects).map(name => ({ name }));
  }, [allComponents]);

  // Get components filtered by project
  const getComponentsForProject = useCallback(
    (projectName: string): ComponentOption[] => {
      return allComponents
        .filter(
          component =>
            component.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT] ===
            projectName,
        )
        .map(component => ({
          name: component.metadata.name,
          projectName:
            component.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT] || '',
        }));
    },
    [allComponents],
  );

  // Fetch endpoints for a component (caches full endpoint data)
  const fetchEndpoints = useCallback(
    async (projectName: string, componentName: string) => {
      const cacheKey = `${projectName}/${componentName}`;
      if (endpointCache[cacheKey]) {
        return endpointCache[cacheKey];
      }

      const component = allComponents.find(
        c =>
          c.metadata.name === componentName &&
          c.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT] === projectName,
      );

      if (!component) return {};

      try {
        const workload: WorkloadResource = await client.fetchWorkloadInfo(
          component,
        );
        const endpoints: EndpointMap = workload?.spec?.endpoints || {};
        setEndpointCache(prev => ({ ...prev, [cacheKey]: endpoints }));
        return endpoints;
      } catch {
        return {};
      }
    },
    [allComponents, client, endpointCache],
  );

  /** Get the effective dependency for a given index (buffer if editing, else stored) */
  const getEffectiveDependency = useCallback(
    (index: number): Dependency | undefined => {
      return editBuffer.isRowEditing(index) && editBuffer.editBuffer
        ? editBuffer.editBuffer
        : dependencies[index];
    },
    [dependencies, editBuffer],
  );

  // Fetch endpoints when dependencies or edit buffer reference uncached components
  useEffect(() => {
    const keysToFetch = new Set<string>();

    dependencies.forEach(dep => {
      const projectName = dep?.project || currentProject;
      const componentName = dep?.component;
      if (projectName && componentName) {
        const cacheKey = `${projectName}/${componentName}`;
        if (!endpointCache[cacheKey]) {
          keysToFetch.add(cacheKey);
        }
      }
    });

    if (editBuffer.editBuffer) {
      const projectName = editBuffer.editBuffer.project || currentProject;
      const componentName = editBuffer.editBuffer.component;
      if (projectName && componentName) {
        const cacheKey = `${projectName}/${componentName}`;
        if (!endpointCache[cacheKey]) {
          keysToFetch.add(cacheKey);
        }
      }
    }

    keysToFetch.forEach(key => {
      const [projectName, componentName] = key.split('/');
      fetchEndpoints(projectName, componentName);
    });
  }, [
    dependencies,
    editBuffer.editBuffer,
    currentProject,
    endpointCache,
    fetchEndpoints,
  ]);

  // Get projects for a dependency
  const getProjects = useCallback((): ProjectOption[] => {
    return projectList;
  }, [projectList]);

  // Get components for a dependency based on its selected project
  // When project is omitted, the API contract means "same project as the consumer"
  const getComponents = useCallback(
    (index: number): ComponentOption[] => {
      const dependency = getEffectiveDependency(index);
      const projectName = dependency?.project || currentProject;
      if (!projectName) return [];
      return getComponentsForProject(projectName);
    },
    [getEffectiveDependency, getComponentsForProject, currentProject],
  );

  // Get endpoints for a dependency based on its selected component
  const getEndpoints = useCallback(
    (index: number): EndpointOption[] => {
      const dependency = getEffectiveDependency(index);
      const projectName = dependency?.project || currentProject;
      const componentName = dependency?.component;
      if (!projectName || !componentName) return [];

      const cacheKey = `${projectName}/${componentName}`;
      const cached = endpointCache[cacheKey];
      if (cached) {
        return Object.keys(cached).map(name => ({ name }));
      }

      // Cache miss — the useEffect will trigger the fetch
      return [];
    },
    [getEffectiveDependency, endpointCache, currentProject],
  );

  // Get available visibility options based on target endpoint and relationship
  const getAvailableVisibilities = useCallback(
    (index: number): ('project' | 'namespace')[] => {
      const dependency = getEffectiveDependency(index);
      const effectiveProject = dependency?.project || currentProject;
      if (!effectiveProject || !dependency?.component || !dependency?.name) {
        return [];
      }

      // Look up the target endpoint's declared visibilities
      const cacheKey = `${effectiveProject}/${dependency.component}`;
      const cached = endpointCache[cacheKey];
      if (!cached) return [];

      const targetEndpoint = cached[dependency.name];
      if (!targetEndpoint) return [];

      // 'project' visibility is implicitly always available on every endpoint
      // (the EndpointEditor treats it as always-selected), so we don't check
      // the stored visibility array for it. Other visibilities must be explicit.
      const endpointVisibilities = targetEndpoint.visibility || [];
      const available: ('project' | 'namespace')[] = [];

      // Find the target component's entity to check namespace
      const targetEntity = allComponents.find(
        c =>
          c.metadata.name === dependency.component &&
          c.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT] ===
            effectiveProject,
      );
      const targetNamespace =
        targetEntity?.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ||
        '';

      // 'project' visibility: target is in the same namespace AND same project.
      // project visibility is implicitly available on all endpoints.
      if (
        targetNamespace === currentNamespace &&
        effectiveProject === currentProject
      ) {
        available.push('project');
      }

      // 'namespace' visibility: only if target endpoint explicitly exposes 'namespace' AND
      // both components are in the same control plane namespace
      if (
        endpointVisibilities.includes('namespace') &&
        targetNamespace === currentNamespace
      ) {
        available.push('namespace');
      }

      return available;
    },
    [
      getEffectiveDependency,
      endpointCache,
      allComponents,
      currentProject,
      currentNamespace,
    ],
  );

  // Handle project change - no additional side effects needed
  const handleProjectChange = useCallback(
    (_index: number, _projectName: string) => {
      // Handled by editBuffer's updateBuffer which clears component, endpoint, visibility
    },
    [],
  );

  // Handle component change - endpoint fetching is handled by the useEffect
  const handleComponentChange = useCallback(
    (_index: number, _componentName: string) => {
      // Endpoint fetching is driven by the useEffect that watches dependency state
    },
    [],
  );

  // Handle endpoint change - no side effects needed
  const handleEndpointChange = useCallback(() => {
    // No side effects needed
  }, []);

  return (
    <DependencyList
      dependencies={dependencies}
      resources={resources}
      disabled={disabled}
      editBuffer={editBuffer}
      onRemoveDependency={onRemoveDependency}
      onAddDependency={onAddDependency}
      getProjects={getProjects}
      getComponents={getComponents}
      getEndpoints={getEndpoints}
      onProjectChange={handleProjectChange}
      onComponentChange={handleComponentChange}
      onEndpointChange={handleEndpointChange}
      getAvailableVisibilities={getAvailableVisibilities}
      projectResources={projectResources}
      outputsByRef={outputsByRef}
      onResourceDependencyReplace={onResourceDependencyReplace}
      onAddResourceDependency={onAddResourceDependency}
      onRemoveResourceDependency={onRemoveResourceDependency}
    />
  );
};
