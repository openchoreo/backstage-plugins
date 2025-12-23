import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Connection,
  ModelsWorkload,
} from '@openchoreo/backstage-plugin-common';
import {
  ConnectionList,
  useConnectionEditBuffer,
  type ConnectionTypeOption,
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

interface ConnectionContentProps {
  connections: { [key: string]: Connection };
  onConnectionReplace: (connectionName: string, connection: Connection) => void;
  onAddConnection: () => string;
  onRemoveConnection: (connectionName: string) => void;
  disabled: boolean;
}

const CONNECTION_TYPES: ConnectionTypeOption[] = [
  { value: 'api', label: 'API' },
];

export const ConnectionContent: FC<ConnectionContentProps> = ({
  connections,
  onConnectionReplace,
  onAddConnection,
  onRemoveConnection,
  disabled,
}) => {
  const catalogApi = useApi(catalogApiRef);
  const client = useApi(openChoreoClientApiRef);
  const { entity: selectedEntity } = useEntity();
  const { setEditingSection } = useWorkloadContext();

  const [allComponents, setAllComponents] = useState<Entity[]>([]);
  const [endpointCache, setEndpointCache] = useState<{
    [key: string]: string[];
  }>({});

  const editBuffer = useConnectionEditBuffer({
    connections,
    onConnectionReplace,
    onRemoveConnection,
  });

  // Report editing state to context
  useEffect(() => {
    setEditingSection('connections', editBuffer.isAnyRowEditing);
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
                selectedEntity.metadata.annotations?.[
                  CHOREO_ANNOTATIONS.PROJECT
                ]
            ),
        ) || [],
      );
    };
    fetchComponents();
  }, [catalogApi, selectedEntity]);

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

  // Fetch endpoints for a component
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

      if (!component) return [];

      try {
        const workload: ModelsWorkload = await client.fetchWorkloadInfo(
          component,
        );
        const endpoints = Object.keys(workload?.endpoints || {});
        setEndpointCache(prev => ({ ...prev, [cacheKey]: endpoints }));
        return endpoints;
      } catch {
        return [];
      }
    },
    [allComponents, client, endpointCache],
  );

  // Get projects for a connection
  const getProjects = useCallback((): ProjectOption[] => {
    return projectList;
  }, [projectList]);

  // Get components for a connection based on its selected project
  const getComponents = useCallback(
    (connectionName: string): ComponentOption[] => {
      const connection =
        editBuffer.isRowEditing(connectionName) && editBuffer.editBuffer
          ? editBuffer.editBuffer
          : connections[connectionName];
      const projectName = connection?.params?.projectName;
      if (!projectName) return [];
      return getComponentsForProject(projectName);
    },
    [connections, editBuffer, getComponentsForProject],
  );

  // Get endpoints for a connection based on its selected component
  const getEndpoints = useCallback(
    (connectionName: string): EndpointOption[] => {
      const connection =
        editBuffer.isRowEditing(connectionName) && editBuffer.editBuffer
          ? editBuffer.editBuffer
          : connections[connectionName];
      const projectName = connection?.params?.projectName;
      const componentName = connection?.params?.componentName;
      if (!projectName || !componentName) return [];

      const cacheKey = `${projectName}/${componentName}`;
      const cached = endpointCache[cacheKey];
      if (cached) {
        return cached.map(name => ({ name }));
      }

      // Trigger fetch (will update cache async)
      fetchEndpoints(projectName, componentName);
      return [];
    },
    [connections, editBuffer, endpointCache, fetchEndpoints],
  );

  // Handle type change - just for triggering endpoint fetch if needed
  const handleTypeChange = useCallback(() => {
    // Type change doesn't need any side effects
  }, []);

  // Handle project change - clear component and endpoint selections
  const handleProjectChange = useCallback(
    (_connectionName: string, _projectName: string) => {
      // This is handled by the editBuffer's updateBufferParams which clears componentName and endpoint
      // No additional side effects needed
    },
    [],
  );

  // Handle component change - fetch endpoints
  const handleComponentChange = useCallback(
    (connectionName: string, componentName: string) => {
      const connection =
        editBuffer.isRowEditing(connectionName) && editBuffer.editBuffer
          ? editBuffer.editBuffer
          : connections[connectionName];
      const projectName = connection?.params?.projectName;
      if (projectName && componentName) {
        fetchEndpoints(projectName, componentName);
      }
    },
    [connections, editBuffer, fetchEndpoints],
  );

  // Handle endpoint change - no side effects needed
  const handleEndpointChange = useCallback(() => {
    // No side effects needed
  }, []);

  return (
    <ConnectionList
      connections={connections}
      disabled={disabled}
      editBuffer={editBuffer}
      onRemoveConnection={onRemoveConnection}
      onAddConnection={onAddConnection}
      connectionTypes={CONNECTION_TYPES}
      getProjects={getProjects}
      getComponents={getComponents}
      getEndpoints={getEndpoints}
      onTypeChange={handleTypeChange}
      onProjectChange={handleProjectChange}
      onComponentChange={handleComponentChange}
      onEndpointChange={handleEndpointChange}
    />
  );
};
