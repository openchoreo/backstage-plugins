import { useState, useEffect, useMemo } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import {
  ModelsWorkload,
  Container,
  WorkloadEndpoint,
  EnvVar,
  FileVar,
  Connection,
  WorkloadType,
} from '@openchoreo/backstage-plugin-common';
import { ContainerContent } from './ContainerContent';
import { EndpointContent } from './EndpointContent';
import { ConnectionContent } from './ConnectionContent';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { Entity } from '@backstage/catalog-model';
import { useWorkloadContext } from '../WorkloadContext';
import {
  useSecretReferences,
  useUrlSyncedTab,
} from '@openchoreo/backstage-plugin-react';
import {
  VerticalTabNav,
  TabItemData,
} from '@openchoreo/backstage-design-system';
import ViewModuleIcon from '@material-ui/icons/ViewModule';
import SettingsInputComponentIcon from '@material-ui/icons/SettingsInputComponent';
import LinkIcon from '@material-ui/icons/Link';
import type { WorkloadChanges } from '../hooks/useWorkloadChanges';

interface WorkloadEditorProps {
  entity: Entity;
  /** Initial tab to display (from URL) */
  initialTab?: string;
  /** Callback when tab changes (to update URL) */
  onTabChange?: (tab: string) => void;
}

const useStyles = makeStyles(() => ({
  tabNav: {
    height: '100%',
    minHeight: 400,
  },
}));

/**
 * Get tab status based on changes and data presence
 */
function getTabStatus(
  changes: WorkloadChanges,
  section: 'containers' | 'endpoints' | 'connections',
  hasData: boolean,
): TabItemData['status'] {
  const sectionChanges = changes[section];
  if (sectionChanges.length > 0) return 'info'; // Has modifications
  if (hasData) return 'success'; // Has data but no changes
  return undefined; // No data
}

export function WorkloadEditor({
  entity,
  initialTab,
  onTabChange,
}: WorkloadEditorProps) {
  const classes = useStyles();
  const { workloadSpec, setWorkloadSpec, isDeploying, builds, changes } =
    useWorkloadContext();
  const { secretReferences } = useSecretReferences();

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

  const [activeTab, setActiveTab] = useUrlSyncedTab({
    initialTab,
    defaultTab: 'containers',
    onTabChange,
  });

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

  const handleEnvVarReplace = (
    containerName: string,
    envIndex: number,
    envVar: EnvVar,
  ) => {
    const container = formData.containers?.[containerName];
    if (!container) return;

    const updatedEnvVars = [...(container.env || [])];
    updatedEnvVars[envIndex] = envVar;

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

  const handleFileVarReplace = (
    containerName: string,
    fileIndex: number,
    fileVar: FileVar,
  ) => {
    const container = formData.containers?.[containerName];
    if (!container) return;

    const updatedFileVars = [...((container as any).files || [])];
    updatedFileVars[fileIndex] = fileVar;

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

  const handleEndpointReplace = (
    endpointName: string,
    endpoint: WorkloadEndpoint,
  ) => {
    const updatedEndpoints = {
      ...formData.endpoints,
      [endpointName]: endpoint,
    };
    const updatedData = { ...formData, endpoints: updatedEndpoints };
    setFormData(updatedData);
    updateWorkloadSpec(updatedData);
  };

  const addEndpoint = (): string => {
    const endpointName = `endpoint-${
      Object.keys(formData.endpoints || {}).length + 1
    }`;
    const updatedEndpoints = {
      ...formData.endpoints,
      [endpointName]: {
        type: 'HTTP',
        port: 8080,
        visibility: ['external'],
      } as WorkloadEndpoint,
    };
    const updatedData = { ...formData, endpoints: updatedEndpoints };
    setFormData(updatedData);
    updateWorkloadSpec(updatedData);
    return endpointName;
  };

  const removeEndpoint = (endpointName: string) => {
    const updatedEndpoints = { ...formData.endpoints };
    delete updatedEndpoints[endpointName];
    const updatedData = { ...formData, endpoints: updatedEndpoints };
    setFormData(updatedData);
    updateWorkloadSpec(updatedData);
  };

  const handleConnectionReplace = (
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

  const addConnection = (): string => {
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
    return connectionName;
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

  const containerCount = Object.keys(formData.containers || {}).length;
  const endpointCount = Object.keys(formData.endpoints || {}).length;
  const connectionCount = Object.keys(formData.connections || {}).length;

  // Memoize tabs with status based on changes
  const tabs: TabItemData[] = useMemo(
    () => [
      {
        id: 'containers',
        label: 'Containers',
        icon: <ViewModuleIcon />,
        count: containerCount,
        status: getTabStatus(changes, 'containers', containerCount > 0),
      },
      {
        id: 'endpoints',
        label: 'Endpoints',
        icon: <SettingsInputComponentIcon />,
        count: endpointCount,
        status: getTabStatus(changes, 'endpoints', endpointCount > 0),
      },
      {
        id: 'connections',
        label: 'Connections',
        icon: <LinkIcon />,
        count: connectionCount,
        status: getTabStatus(changes, 'connections', connectionCount > 0),
      },
    ],
    [containerCount, endpointCount, connectionCount, changes],
  );

  return (
    <VerticalTabNav
      tabs={tabs}
      activeTabId={activeTab}
      onChange={setActiveTab}
      className={classes.tabNav}
    >
      {activeTab === 'containers' && (
        <ContainerContent
          disabled={isDeploying}
          containers={formData.containers || {}}
          onContainerChange={handleContainerChange}
          onEnvVarChange={handleEnvVarChange}
          onEnvVarReplace={handleEnvVarReplace}
          onFileVarChange={handleFileVarChange}
          onFileVarReplace={handleFileVarReplace}
          onAddContainer={addContainer}
          onRemoveContainer={removeContainer}
          onAddEnvVar={addEnvVar}
          onRemoveEnvVar={removeEnvVar}
          onAddFileVar={addFileVar}
          onRemoveFileVar={removeFileVar}
          onArrayFieldChange={handleArrayFieldChange}
          singleContainerMode
          builds={builds}
          secretReferences={secretReferences}
        />
      )}
      {activeTab === 'endpoints' && (
        <EndpointContent
          disabled={isDeploying}
          endpoints={formData.endpoints || {}}
          onEndpointReplace={handleEndpointReplace}
          onAddEndpoint={addEndpoint}
          onRemoveEndpoint={removeEndpoint}
        />
      )}
      {activeTab === 'connections' && (
        <ConnectionContent
          disabled={isDeploying}
          connections={formData.connections || {}}
          onConnectionReplace={handleConnectionReplace}
          onAddConnection={addConnection}
          onRemoveConnection={removeConnection}
        />
      )}
    </VerticalTabNav>
  );
}
