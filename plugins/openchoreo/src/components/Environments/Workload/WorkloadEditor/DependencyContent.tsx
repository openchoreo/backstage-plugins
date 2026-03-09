import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dependency,
  ModelsWorkload,
  WorkloadEndpoint,
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
  onDependencyReplace: (index: number, dependency: Dependency) => void;
  onAddDependency: () => number;
  onRemoveDependency: (index: number) => void;
  disabled: boolean;
}

/** Cached endpoint data for a component, keyed by endpoint name */
type EndpointMap = { [endpointName: string]: WorkloadEndpoint };

export const DependencyContent: FC<DependencyContentProps> = ({
  dependencies,
  onDependencyReplace,
  onAddDependency,
  onRemoveDependency,
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
        const workload: ModelsWorkload = await client.fetchWorkloadInfo(
          component,
        );
        const endpoints: EndpointMap = workload?.endpoints || {};
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
      if (
        !effectiveProject ||
        !dependency?.component ||
        !dependency?.name
      ) {
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
    />
  );
};

