import { useState, useEffect } from 'react';
import { Box, Button, CircularProgress } from '@material-ui/core';
import {
  ModelsWorkload,
  Container,
  WorkloadEndpoint,
  EnvVar,
  FileVar,
  Connection,
  WorkloadType,
} from '@openchoreo/backstage-plugin-common';
import { ContainerSection } from './ContainerSection';
import { EndpointSection } from './EndpointSection';
import { ConnectionSection } from './ConnectionSection';
import { Alert } from '@material-ui/lab';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { Entity } from '@backstage/catalog-model';
import { useWorkloadContext } from '../WorkloadContext';

interface WorkloadEditorProps {
  onDeploy: () => Promise<void>;
  entity: Entity;
}

export function WorkloadEditor({ onDeploy, entity }: WorkloadEditorProps) {
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
  const [error, setError] = useState<string | null>(null);

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

  const containerCount = Object.keys(formData.containers || {}).length;

  const handleDeploy = async () => {
    if (containerCount === 0) {
      setError('Please add a container');
      return;
    }
    setError(null);
    try {
      await onDeploy();
    } catch (e: any) {
      setError(e.message);
    }
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

  const handleFileVarChange = (
    containerName: string,
    fileIndex: number,
    field: keyof FileVar,
    value: string,
  ) => {
    const container = formData.containers?.[containerName];
    if (!container) return;

    const updatedFileVars = [...((container as any).files || [])];
    updatedFileVars[fileIndex] = {
      ...updatedFileVars[fileIndex],
      [field]: value,
    };

    handleContainerChange(containerName, 'files' as any, updatedFileVars);
  };

  const addFileVar = (containerName: string) => {
    const container = formData.containers?.[containerName];
    if (!container) return;

    const newFileVar: FileVar = { key: '', mountPath: '', value: '' };
    const updatedFileVars = [...((container as any).files || []), newFileVar];
    handleContainerChange(containerName, 'files' as any, updatedFileVars);
  };

  const removeFileVar = (containerName: string, fileIndex: number) => {
    const container = formData.containers?.[containerName];
    if (!container) return;

    const updatedFileVars =
      (container as any).files?.filter(
        (_: any, index: number) => index !== fileIndex,
      ) || [];
    handleContainerChange(containerName, 'files' as any, updatedFileVars);
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
        files: [],
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
          onFileVarChange={handleFileVarChange}
          onAddContainer={addContainer}
          onRemoveContainer={removeContainer}
          onAddEnvVar={addEnvVar}
          onRemoveEnvVar={removeEnvVar}
          onAddFileVar={addFileVar}
          onRemoveFileVar={removeFileVar}
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
      {error && (
        <Box mb={2}>
          <Alert severity="error">{error}</Alert>
        </Box>
      )}
      <Box display="flex" justifyContent="flex-end" pt={3} pb={2} px={2}>
        <Button
          disabled={isDeploying}
          variant="contained"
          color="primary"
          onClick={handleDeploy}
          size="large"
          startIcon={isDeploying ? <CircularProgress size={20} /> : undefined}
        >
          {isDeploying ? 'Deploying...' : 'Submit & Deploy'}
        </Button>
      </Box>
    </Box>
  );
}
