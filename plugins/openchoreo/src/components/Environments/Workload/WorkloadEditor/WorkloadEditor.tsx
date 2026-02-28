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
  section: 'container' | 'endpoints' | 'connections',
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
  const { workloadSpec, setWorkloadSpec, isDeploying, changes } =
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
    endpoints: {},
    connections: {},
  });

  const [workloadType, setWorkloadType] = useState<WorkloadType>('Service');

  const [activeTab, setActiveTab] = useUrlSyncedTab({
    initialTab,
    defaultTab: 'container',
    onTabChange,
  });

  useEffect(() => {
    if (workloadSpec) {
      const { type, ...rest } = workloadSpec;
      setFormData(rest);
      if (type) setWorkloadType(type);
    }
  }, [workloadSpec]);

  const updateWorkloadSpec = (updatedData: Omit<ModelsWorkload, 'type'>) => {
    setFormData(updatedData);
    setWorkloadSpec({ ...updatedData, type: workloadType });
  };

  const updateContainer = (updated: Container) => {
    const updatedData = { ...formData, container: updated };
    setFormData(updatedData);
    setWorkloadSpec({ ...updatedData, type: workloadType });
  };

  const handleContainerChange = (field: keyof Container, value: any) => {
    if (!formData.container) return;
    updateContainer({ ...formData.container, [field]: value } as Container);
  };

  const handleEnvVarChange = (
    envIndex: number,
    field: keyof EnvVar,
    value: string,
  ) => {
    if (!formData.container) return;
    const env = [...(formData.container.env || [])];
    env[envIndex] = { ...env[envIndex], [field]: value };
    updateContainer({ ...formData.container, env });
  };

  const handleEnvVarReplace = (envIndex: number, envVar: EnvVar) => {
    if (!formData.container) return;
    const env = [...(formData.container.env || [])];
    env[envIndex] = envVar;
    updateContainer({ ...formData.container, env });
  };

  const addEnvVar = () => {
    if (!formData.container) return;
    const env = [...(formData.container.env || []), { key: '', value: '' }];
    updateContainer({ ...formData.container, env });
  };

  const removeEnvVar = (envIndex: number) => {
    if (!formData.container) return;
    const env = (formData.container.env || []).filter((_, i) => i !== envIndex);
    updateContainer({ ...formData.container, env });
  };

  const handleFileVarChange = (
    fileIndex: number,
    field: keyof FileVar,
    value: string,
  ) => {
    if (!formData.container) return;
    const files = [...((formData.container as any).files || [])];
    files[fileIndex] = { ...files[fileIndex], [field]: value };
    updateContainer({ ...formData.container, files } as any);
  };

  const addFileVar = () => {
    if (!formData.container) return;
    const files = [
      ...((formData.container as any).files || []),
      { key: '', mountPath: '', value: '' },
    ];
    updateContainer({ ...formData.container, files } as any);
  };

  const removeFileVar = (fileIndex: number) => {
    if (!formData.container) return;
    const files = ((formData.container as any).files || []).filter(
      (_: any, i: number) => i !== fileIndex,
    );
    updateContainer({ ...formData.container, files } as any);
  };

  const handleFileVarReplace = (fileIndex: number, fileVar: FileVar) => {
    if (!formData.container) return;
    const files = [...((formData.container as any).files || [])];
    files[fileIndex] = fileVar;
    updateContainer({ ...formData.container, files } as any);
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

  const handleArrayFieldChange = (field: 'command' | 'args', value: string) => {
    const arrayValue = value
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
    handleContainerChange(field, arrayValue);
  };

  const containerCount = formData.container ? 1 : 0;
  const endpointCount = Object.keys(formData.endpoints || {}).length;
  const connectionCount = Object.keys(formData.connections || {}).length;

  // Memoize tabs with status based on changes
  const tabs: TabItemData[] = useMemo(
    () => [
      {
        id: 'container',
        label: 'Container',
        icon: <ViewModuleIcon />,
        count: containerCount,
        status: getTabStatus(changes, 'container', containerCount > 0),
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
      {activeTab === 'container' && (
        <ContainerContent
          disabled={isDeploying}
          container={formData.container}
          onContainerChange={handleContainerChange}
          onEnvVarChange={handleEnvVarChange}
          onEnvVarReplace={handleEnvVarReplace}
          onFileVarChange={handleFileVarChange}
          onFileVarReplace={handleFileVarReplace}
          onAddEnvVar={addEnvVar}
          onRemoveEnvVar={removeEnvVar}
          onAddFileVar={addFileVar}
          onRemoveFileVar={removeFileVar}
          onArrayFieldChange={handleArrayFieldChange}
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
