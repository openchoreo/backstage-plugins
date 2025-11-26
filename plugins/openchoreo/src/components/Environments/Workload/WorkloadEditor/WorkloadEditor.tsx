import { useState, useEffect } from 'react';
import { Box } from '@material-ui/core';
import {
  ModelsWorkload,
  Container,
  WorkloadEndpoint,
  EnvVar,
  Connection,
  WorkloadType,
} from '@openchoreo/backstage-plugin-common';
import { ContainerSection } from './ContainerSection';
import { EndpointSection } from './EndpointSection';
import { ConnectionSection } from './ConnectionSection';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { Entity } from '@backstage/catalog-model';
import { useWorkloadContext } from '../WorkloadContext';

interface WorkloadEditorProps {
  entity: Entity;
}

export function WorkloadEditor({ entity }: WorkloadEditorProps) {
  const { workloadSpec, setWorkloadSpec, isDeploying } = useWorkloadContext();

  const componentName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
  const projectName = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];

  const [formData, setFormData] = useState<Omit<ModelsWorkload, 'type'>>({
    name: entity.metadata.name,
    owner: {
      projectName: projectName || '',
      componentName: componentName || '',
    },
    containers: {},
    endpoints: {},
    connections: {},
  });

  const [workloadType, setWorkloadType] = useState<WorkloadType>('Service');

  useEffect(() => {
    if (workloadSpec) {
      setFormData(workloadSpec);
      if (workloadSpec.type) {
        setWorkloadType(workloadSpec.type);
      }
    }
  }, [workloadSpec]);

  // Helper function to update workload spec
  const updateWorkloadSpec = (updatedData: Omit<ModelsWorkload, 'type'>) => {
    setFormData(updatedData);
    setWorkloadSpec({ ...updatedData, type: workloadType });
  };

  const handleContainerChange = (
    containerName: string,
    field: keyof Container,
    value: any,
  ) => {
    const updatedContainers = {
      ...formData.containers,
      [containerName]: {
        ...(formData.containers?.[containerName] || {}),
        [field]: value,
      } as Container,
    };
    const updatedData = { ...formData, containers: updatedContainers };
    setFormData(updatedData);
    updateWorkloadSpec(updatedData);
  };

  const handleEnvVarChange = (
    containerName: string,
    envIndex: number,
    field: keyof EnvVar,
    value: string,
  ) => {
    const container = formData.containers?.[containerName];
    if (!container) return;

    const updatedEnvVars = [...(container.env || [])];
    updatedEnvVars[envIndex] = { ...updatedEnvVars[envIndex], [field]: value };

    handleContainerChange(containerName, 'env', updatedEnvVars);
  };

  const addEnvVar = (containerName: string) => {
    const container = formData.containers?.[containerName];
    if (!container) return;

    const newEnvVar: EnvVar = { key: '', value: '' };
    const updatedEnvVars = [...(container.env || []), newEnvVar];
    handleContainerChange(containerName, 'env', updatedEnvVars);
  };

  const removeEnvVar = (containerName: string, envIndex: number) => {
    const container = formData.containers?.[containerName];
    if (!container) return;

    const updatedEnvVars =
      container.env?.filter((_, index) => index !== envIndex) || [];
    handleContainerChange(containerName, 'env', updatedEnvVars);
  };

  const addContainer = () => {
    const containerName = `container-${
      Object.keys(formData.containers || {}).length
    }`;
    const updatedContainers = {
      ...formData.containers,
      [Object.keys(formData.containers || {}).length === 0
        ? 'main'
        : containerName]: {
        name:
          Object.keys(formData.containers || {}).length === 0
            ? 'main'
            : containerName,
        image: '',
        resources: {},
        env: [],
        command: [],
        args: [],
      } as Container,
    };
    const updatedData = { ...formData, containers: updatedContainers };
    setFormData(updatedData);
    updateWorkloadSpec(updatedData);
  };

  const removeContainer = (containerName: string) => {
    const updatedContainers = { ...formData.containers };
    delete updatedContainers[containerName];
    const updatedData = { ...formData, containers: updatedContainers };
    setFormData(updatedData);
    updateWorkloadSpec(updatedData);
  };

  const handleEndpointChange = (
    endpointName: string,
    field: keyof WorkloadEndpoint,
    value: any,
  ) => {
    const updatedEndpoints = {
      ...formData.endpoints,
      [endpointName]: {
        ...formData.endpoints?.[endpointName],
        [field]: value,
      } as WorkloadEndpoint,
    };
    const updatedData = { ...formData, endpoints: updatedEndpoints };
    setFormData(updatedData);
    updateWorkloadSpec(updatedData);
  };

  const addEndpoint = () => {
    const endpointName = `endpoint-${
      Object.keys(formData.endpoints || {}).length + 1
    }`;
    const updatedEndpoints = {
      ...formData.endpoints,
      [endpointName]: {
        type: 'HTTP',
        port: 8080,
      } as WorkloadEndpoint,
    };
    const updatedData = { ...formData, endpoints: updatedEndpoints };
    setFormData(updatedData);
    updateWorkloadSpec(updatedData);
  };

  const removeEndpoint = (endpointName: string) => {
    const updatedEndpoints = { ...formData.endpoints };
    delete updatedEndpoints[endpointName];
    const updatedData = { ...formData, endpoints: updatedEndpoints };
    setFormData(updatedData);
    updateWorkloadSpec(updatedData);
  };

  const handleConnectionChange = (
    connectionName: string,
    connection: Connection,
  ) => {
    const updatedConnections = {
      ...formData.connections,
      [connectionName]: connection,
    };
    const updatedData = { ...formData, connections: updatedConnections };
    setFormData(updatedData);
    updateWorkloadSpec(updatedData);
  };

  const addConnection = () => {
    const connectionName = `connection-${
      Object.keys(formData.connections || {}).length + 1
    }`;
    const newConnection: Connection = {
      type: '',
      params: {
        componentName: '',
        endpoint: '',
        projectName: '',
      },
      inject: {
        env: [],
      },
    };
    const updatedConnections = {
      ...formData.connections,
      [connectionName]: newConnection,
    };
    const updatedData = { ...formData, connections: updatedConnections };
    setFormData(updatedData);
    updateWorkloadSpec(updatedData);
  };

  const removeConnection = (connectionName: string) => {
    const updatedConnections = { ...formData.connections };
    delete updatedConnections[connectionName];
    const updatedData = { ...formData, connections: updatedConnections };
    setFormData(updatedData);
    updateWorkloadSpec(updatedData);
  };

  const handleArrayFieldChange = (
    containerName: string,
    field: 'command' | 'args',
    value: string,
  ) => {
    const arrayValue = value
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
    handleContainerChange(containerName, field, arrayValue);
  };

  return (
    <Box overflow="hidden">
      <Box mb={2}>
        <ContainerSection
          disabled={isDeploying}
          containers={formData.containers || {}}
          onContainerChange={handleContainerChange}
          onEnvVarChange={handleEnvVarChange}
          onAddContainer={addContainer}
          onRemoveContainer={removeContainer}
          onAddEnvVar={addEnvVar}
          onRemoveEnvVar={removeEnvVar}
          onArrayFieldChange={handleArrayFieldChange}
          singleContainerMode
        />
      </Box>
      <Box mb={2}>
        <EndpointSection
          disabled={isDeploying}
          endpoints={formData.endpoints || {}}
          onEndpointChange={handleEndpointChange}
          onAddEndpoint={addEndpoint}
          onRemoveEndpoint={removeEndpoint}
        />
      </Box>
      <Box mb={2}>
        <ConnectionSection
          disabled={isDeploying}
          connections={formData.connections || {}}
          onConnectionChange={handleConnectionChange}
          onAddConnection={addConnection}
          onRemoveConnection={removeConnection}
        />
      </Box>
    </Box>
  );
}
