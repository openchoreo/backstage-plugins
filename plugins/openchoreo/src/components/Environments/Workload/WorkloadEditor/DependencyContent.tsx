import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dependency,
  isReleaseLinesEnabledComponent,
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
  type ReleaseLineOption,
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
  const [allReleaseLines, setAllReleaseLines] = useState<Entity[]>([]);
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

  const findTargetComponent = useCallback(
    (dependency: Dependency | undefined): Entity | undefined => {
      const projectName = dependency?.project || currentProject;
      if (!dependency?.component) return undefined;
      return allComponents.find(
        c =>
          c.metadata.name === dependency.component &&
          c.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT] === projectName,
      );
    },
    [allComponents, currentProject],
  );

  const requiresReleaseLine = useCallback(
    (dependency: Dependency): boolean => {
      const target = findTargetComponent(dependency);
      return !!target && isReleaseLinesEnabledComponent(target);
    },
    [findTargetComponent],
  );

  const editBuffer = useDependencyEditBuffer({
    dependencies,
    onDependencyReplace,
    onRemoveDependency,
    defaultProject: currentProject,
    requiresReleaseLine,
  });

  // Report editing state to context
  useEffect(() => {
    setEditingSection('dependencies', editBuffer.isAnyRowEditing);
  }, [editBuffer.isAnyRowEditing, setEditingSection]);

  // Fetch all components from catalog
  useEffect(() => {
    const fetchComponents = async () => {
      const entities = await catalogApi.getEntities();
      setAllReleaseLines(
        entities.items?.filter(entity => entity.kind === 'ReleaseLine') || [],
      );
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

  // Pre-fetch outputs for every project Resource entity. The editor's
  // in-row picker lets the user switch between any project resource, so we
  // need the outputs ready ahead of any pick. Cached by ref; FORM<->YAML
  // toggles don't re-fetch.
  useEffect(() => {
    if (projectResources.length === 0) return;
    projectResources.forEach(async entity => {
      const ref = entity.metadata.name;
      if (ref in outputsByRef) return;
      try {
        const result = await client.fetchResourceTypeOutputs(entity);
        setOutputsByRef(prev => ({ ...prev, [ref]: result.data ?? [] }));
      } catch {
        // Cache an empty array so we don't retry indefinitely; the editor
        // tolerates missing outputs (no kind chips, empty Add dropdown).
        setOutputsByRef(prev => ({ ...prev, [ref]: [] }));
      }
    });
  }, [projectResources, outputsByRef, client]);

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

  // Endpoint cache key for a dependency's target. A release-lines-enabled
  // target has a Workload per line, so its endpoints are keyed by the line.
  const endpointCacheKey = useCallback(
    (dependency: Dependency | undefined): string | undefined => {
      const projectName = dependency?.project || currentProject;
      if (!dependency || !projectName || !dependency.component) {
        return undefined;
      }
      const key = `${projectName}/${dependency.component}`;
      if (!requiresReleaseLine(dependency)) return key;
      return dependency.releaseLine
        ? `${key}@${dependency.releaseLine}`
        : undefined;
    },
    [currentProject, requiresReleaseLine],
  );

  // Fetch endpoints for a dependency's target (caches full endpoint data)
  const fetchEndpoints = useCallback(
    async (dependency: Dependency) => {
      const cacheKey = endpointCacheKey(dependency);
      if (!cacheKey) return {};
      if (endpointCache[cacheKey]) {
        return endpointCache[cacheKey];
      }

      const component = findTargetComponent(dependency);
      if (!component) return {};

      try {
        const workload: WorkloadResource = await client.fetchWorkloadInfo(
          component,
          requiresReleaseLine(dependency) ? dependency.releaseLine : undefined,
        );
        const endpoints: EndpointMap = workload?.spec?.endpoints || {};
        setEndpointCache(prev => ({ ...prev, [cacheKey]: endpoints }));
        return endpoints;
      } catch {
        return {};
      }
    },
    [
      endpointCacheKey,
      endpointCache,
      findTargetComponent,
      client,
      requiresReleaseLine,
    ],
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

  // Fetch endpoints when dependencies or edit buffer reference uncached targets
  useEffect(() => {
    const toFetch = new Map<string, Dependency>();
    const candidates = editBuffer.editBuffer
      ? [...dependencies, editBuffer.editBuffer]
      : dependencies;

    candidates.forEach(dep => {
      const cacheKey = endpointCacheKey(dep);
      if (cacheKey && !endpointCache[cacheKey]) {
        toFetch.set(cacheKey, dep);
      }
    });

    toFetch.forEach(dep => fetchEndpoints(dep));
  }, [
    dependencies,
    editBuffer.editBuffer,
    endpointCacheKey,
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
      const cacheKey = endpointCacheKey(getEffectiveDependency(index));
      const cached = cacheKey ? endpointCache[cacheKey] : undefined;
      if (cached) {
        return Object.keys(cached).map(name => ({ name }));
      }

      // Cache miss — the useEffect will trigger the fetch
      return [];
    },
    [getEffectiveDependency, endpointCacheKey, endpointCache],
  );

  // Release lines of the dependency's target; undefined when it has none
  const getReleaseLines = useCallback(
    (index: number): ReleaseLineOption[] | undefined => {
      const target = findTargetComponent(getEffectiveDependency(index));
      if (!target || !isReleaseLinesEnabledComponent(target)) return undefined;
      const annotations = target.metadata.annotations ?? {};
      return allReleaseLines
        .filter(line => {
          const lineAnnotations = line.metadata.annotations ?? {};
          return (
            lineAnnotations[CHOREO_ANNOTATIONS.COMPONENT] ===
              target.metadata.name &&
            lineAnnotations[CHOREO_ANNOTATIONS.PROJECT] ===
              annotations[CHOREO_ANNOTATIONS.PROJECT] &&
            lineAnnotations[CHOREO_ANNOTATIONS.NAMESPACE] ===
              annotations[CHOREO_ANNOTATIONS.NAMESPACE]
          );
        })
        .map(line => ({
          name:
            line.metadata.annotations?.[CHOREO_ANNOTATIONS.RELEASE_LINE] ||
            line.metadata.name,
        }));
    },
    [findTargetComponent, getEffectiveDependency, allReleaseLines],
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
      const cacheKey = endpointCacheKey(dependency);
      const cached = cacheKey ? endpointCache[cacheKey] : undefined;
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
      endpointCacheKey,
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
      getReleaseLines={getReleaseLines}
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
