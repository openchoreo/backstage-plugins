import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { Box, Typography } from '@material-ui/core';
import { FormYamlToggle } from '@openchoreo/backstage-design-system';
import YAML from 'yaml';
import {
  ModelsWorkload,
  Container,
  WorkloadEndpoint,
  EnvVar,
  FileVar,
  Dependency,
  WorkloadType,
} from '@openchoreo/backstage-plugin-common';
import { ContainerContent } from './ContainerContent';
import { EndpointContent } from './EndpointContent';
import { DependencyContent } from './DependencyContent';
import { TraitsContent } from './TraitsContent';
import { ParametersContent } from './ParametersContent';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { Entity } from '@backstage/catalog-model';
import { useWorkloadContext } from '../WorkloadContext';
import {
  useSecretReferences,
  useUrlSyncedTab,
  YamlEditor,
} from '@openchoreo/backstage-plugin-react';
import {
  VerticalTabNav,
  TabItemData,
} from '@openchoreo/backstage-design-system';
import MemoryIcon from '@material-ui/icons/Memory';
import SettingsIcon from '@material-ui/icons/Settings';
import type { ComponentTrait } from '../../../../api/OpenChoreoClientApi';
import type { TraitWithState } from '../../../Traits/types';
import type { WorkloadChanges } from '../hooks/useWorkloadChanges';

interface WorkloadEditorProps {
  entity: Entity;
  /** Full raw workload resource from the API (for YAML display) */
  rawWorkload?: Record<string, unknown> | null;
  initialTab?: string;
  onTabChange?: (tab: string) => void;
  traitsState?: TraitWithState[];
  allowedTraits?: Array<{ kind?: string; name: string }> | null;
  onAddTrait?: (trait: ComponentTrait) => void;
  onEditTrait?: (instanceName: string, updated: ComponentTrait) => void;
  onDeleteTrait?: (instanceName: string) => void;
  onUndoDeleteTrait?: (instanceName: string) => void;
  hasTraitChanges?: boolean;
  hasParameters?: boolean;
  parametersSchema?: Record<string, unknown> | null;
  parameters?: Record<string, unknown>;
  onParametersChange?: (params: Record<string, unknown>) => void;
  hasParameterChanges?: boolean;
  workloadChanges?: WorkloadChanges;
  parameterChangesCount?: number;
}

const WORKLOAD_SUB_TABS = new Set(['container', 'endpoints', 'dependencies']);

const WORKLOAD_NAV_IDS = [
  { id: 'container', label: 'Container' },
  { id: 'endpoints', label: 'Endpoints' },
  { id: 'dependencies', label: 'Dependencies' },
];

const useStyles = makeStyles(theme => ({
  outerNav: {
    height: '100%',
    minHeight: 400,
  },
  sectionContent: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    gap: theme.spacing(2),
  },
  innerPanel: {
    display: 'flex',
    flexDirection: 'column',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    flex: 1,
    overflow: 'hidden',
    backgroundColor: theme.palette.background.paper,
  },
  innerTabs: {
    display: 'flex',
    alignItems: 'center',
    borderBottom: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(0, 1.5, 0, 0.5),
    minHeight: 48,
  },
  innerTabsSpacer: {
    flex: 1,
  },
  innerTab: {
    display: 'flex',
    alignItems: 'center',
    alignSelf: 'stretch',
    padding: theme.spacing(0, 2),
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    color: theme.palette.text.secondary,
    borderBottom: '2px solid transparent',
    marginBottom: -1,
    transition: 'color 0.15s ease, border-color 0.15s ease',
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
    '&:hover': {
      color: theme.palette.text.primary,
    },
  },
  innerTabActive: {
    color: theme.palette.primary.main,
    borderBottomColor: theme.palette.primary.main,
    fontWeight: 600,
  },
  innerTabCount: {
    marginLeft: 6,
    fontSize: 11,
    fontWeight: 600,
    minWidth: 18,
    height: 18,
    lineHeight: '18px',
    textAlign: 'center' as const,
    borderRadius: 9,
    backgroundColor:
      theme.palette.type === 'dark'
        ? 'rgba(255,255,255,0.1)'
        : theme.palette.grey[200],
    color: theme.palette.text.secondary,
    display: 'inline-block',
    padding: '0 5px',
  },
  innerContent: {
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing(2),
    minWidth: 0,
  },
  yamlEditorContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(2),
    minHeight: 400,
  },
  yamlError: {
    color: theme.palette.error.main,
    fontSize: '0.75rem',
    marginBottom: theme.spacing(1),
  },
}));

/**
 * Build a YAML representation of the full workload resource.
 * Merges current form data into the raw resource's spec so that form
 * edits are always reflected in the YAML view.
 */
function workloadToYaml(
  rawWorkload: Record<string, unknown> | null | undefined,
  formData: Omit<ModelsWorkload, 'type'>,
): string {
  if (rawWorkload) {
    // Merge the current form data into the raw resource's spec
    const merged = { ...rawWorkload, spec: { ...formData } };
    return YAML.stringify(merged, { indent: 2 });
  }
  return YAML.stringify(formData, { indent: 2 });
}

/**
 * Parse YAML string and extract spec fields for the form.
 * Returns spec from the parsed workload resource.
 */
function yamlToWorkload(
  yamlStr: string,
): { spec: Omit<ModelsWorkload, 'type'>; raw: Record<string, unknown> } | null {
  try {
    const parsed = YAML.parse(yamlStr);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    // If the parsed YAML has a spec field, it's a full resource
    if (parsed.spec && typeof parsed.spec === 'object') {
      return { spec: parsed.spec, raw: parsed };
    }
    // Fallback: treat entire YAML as spec
    return { spec: parsed, raw: parsed };
  } catch {
    return null;
  }
}

export function WorkloadEditor({
  entity,
  rawWorkload,
  initialTab,
  onTabChange,
  traitsState,
  allowedTraits,
  onAddTrait,
  onEditTrait,
  onDeleteTrait,
  onUndoDeleteTrait,
  hasTraitChanges: _hasTraitChanges,
  hasParameters,
  parametersSchema,
  parameters,
  onParametersChange,
  hasParameterChanges: _hasParameterChanges,
  workloadChanges,
  parameterChangesCount = 0,
}: WorkloadEditorProps) {
  const classes = useStyles();
  const { workloadSpec, setWorkloadSpec, isDeploying } = useWorkloadContext();
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
    dependencies: { endpoints: [] },
  });

  const [workloadType, setWorkloadType] = useState<WorkloadType>('Service');

  // YAML mode state
  const [isYamlMode, setIsYamlMode] = useState(false);
  const [yamlContent, setYamlContent] = useState('');
  const [yamlError, setYamlError] = useState<string | undefined>();

  // Local copy of the raw workload resource so YAML edits to metadata etc. persist
  const localRawRef = useRef<Record<string, unknown> | null>(
    rawWorkload ?? null,
  );
  // Sync when the prop changes (e.g. initial fetch)
  useEffect(() => {
    localRawRef.current = rawWorkload ?? null;
  }, [rawWorkload]);

  // Track last active sub-tab per section for smooth outer tab switching
  const lastWorkloadTabRef = useRef('container');
  const lastComponentTabRef = useRef(hasParameters ? 'parameters' : 'traits');

  const [activeTab, setActiveTab] = useUrlSyncedTab({
    initialTab,
    defaultTab: 'container',
    onTabChange,
  });

  // Derive which outer section is active from the current sub-tab
  const outerSection = WORKLOAD_SUB_TABS.has(activeTab)
    ? 'workload'
    : 'component';

  // Remember last sub-tab per section
  useEffect(() => {
    if (WORKLOAD_SUB_TABS.has(activeTab)) {
      lastWorkloadTabRef.current = activeTab;
    } else if (activeTab === 'traits' || activeTab === 'parameters') {
      lastComponentTabRef.current = activeTab;
    }
  }, [activeTab]);

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
    oldNameToRemove?: string,
  ) => {
    const updatedEndpoints = { ...formData.endpoints };
    if (oldNameToRemove && oldNameToRemove !== endpointName) {
      delete updatedEndpoints[oldNameToRemove];
    }
    updatedEndpoints[endpointName] = endpoint;
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

  const handleDependencyReplace = (index: number, dependency: Dependency) => {
    const currentEndpoints = formData.dependencies?.endpoints || [];
    const updatedEndpoints = [...currentEndpoints];
    updatedEndpoints[index] = dependency;
    const updatedData = {
      ...formData,
      dependencies: { endpoints: updatedEndpoints },
    };
    setFormData(updatedData);
    updateWorkloadSpec(updatedData);
  };

  const addDependency = (): number => {
    const newDependency: Dependency = {
      component: '',
      name: '',
      visibility: 'project',
      envBindings: {},
    };
    const currentEndpoints = formData.dependencies?.endpoints || [];
    const updatedEndpoints = [...currentEndpoints, newDependency];
    const updatedData = {
      ...formData,
      dependencies: { endpoints: updatedEndpoints },
    };
    setFormData(updatedData);
    updateWorkloadSpec(updatedData);
    return updatedEndpoints.length - 1;
  };

  const removeDependency = (index: number) => {
    const updatedEndpoints = (formData.dependencies?.endpoints || []).filter(
      (_, i) => i !== index,
    );
    const updatedData = {
      ...formData,
      dependencies: { endpoints: updatedEndpoints },
    };
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

  // --- YAML mode handlers ---

  const handleModeToggle = useCallback(
    (newMode: 'form' | 'yaml') => {
      if (newMode === 'yaml' && !isYamlMode) {
        setYamlContent(workloadToYaml(localRawRef.current, formData));
        setYamlError(undefined);
        setIsYamlMode(true);
      } else if (newMode === 'form' && isYamlMode) {
        const parsed = yamlToWorkload(yamlContent);
        if (parsed) {
          localRawRef.current = parsed.raw;
          setFormData(parsed.spec);
          setWorkloadSpec({ ...parsed.spec, type: workloadType });
          setYamlError(undefined);
          setIsYamlMode(false);
        } else {
          setYamlError('Fix YAML errors before switching to Form view');
        }
      }
    },
    [isYamlMode, formData, yamlContent, workloadType, setWorkloadSpec],
  );

  const handleYamlChange = useCallback(
    (content: string) => {
      setYamlContent(content);
      const parsed = yamlToWorkload(content);
      if (parsed) {
        setYamlError(undefined);
        localRawRef.current = parsed.raw;
        // Apply valid YAML spec to workload state in real-time
        setFormData(parsed.spec);
        setWorkloadSpec({ ...parsed.spec, type: workloadType });
      } else {
        setYamlError('Invalid YAML');
      }
    },
    [workloadType, setWorkloadSpec],
  );

  // --- Outer nav ---

  // Compute change indicators
  const hasWorkloadChanges = workloadChanges?.hasChanges ?? false;
  const traitChangesCount = traitsState
    ? traitsState.filter(t => t.state !== 'original').length
    : 0;
  const hasComponentChanges =
    traitChangesCount > 0 || parameterChangesCount > 0;

  const outerTabs: TabItemData[] = useMemo(
    () => [
      {
        id: 'workload',
        label: 'Workload',
        icon: <SettingsIcon />,
        ...(hasWorkloadChanges && { status: 'info' as const }),
      },
      {
        id: 'component',
        label: 'Component',
        icon: <MemoryIcon />,
        ...(hasComponentChanges && { status: 'info' as const }),
      },
    ],
    [hasWorkloadChanges, hasComponentChanges],
  );

  const handleOuterTabChange = useCallback(
    (tabId: string) => {
      if (tabId === 'workload') {
        setActiveTab(lastWorkloadTabRef.current);
      } else {
        setActiveTab(lastComponentTabRef.current);
      }
    },
    [setActiveTab],
  );

  // --- Inner nav items with counts ---

  const endpointCount = Object.keys(formData.endpoints || {}).length;
  const dependencyCount = (formData.dependencies?.endpoints || []).length;

  const workloadNavItems = useMemo(
    () =>
      WORKLOAD_NAV_IDS.map(item => ({
        ...item,
        ...(item.id === 'endpoints' && { count: endpointCount }),
        ...(item.id === 'dependencies' && { count: dependencyCount }),
      })),
    [endpointCount, dependencyCount],
  );

  // Show Traits tab only if the CT has allowedTraits or there are already existing traits
  const hasTraits =
    (allowedTraits && allowedTraits.length > 0) ||
    (traitsState && traitsState.length > 0);

  const componentNavItems = useMemo(() => {
    const items: { id: string; label: string; count?: number }[] = [];
    if (hasParameters) {
      items.push({ id: 'parameters', label: 'Parameters' });
    }
    if (hasTraits) {
      items.push({
        id: 'traits',
        label: 'Traits',
        count: traitsState?.length ?? 0,
      });
    }
    return items;
  }, [hasParameters, hasTraits, traitsState?.length]);

  // --- Render helpers ---

  const renderInnerTab = (
    item: { id: string; label: string; count?: number },
    currentTab: string,
    onSelect: (id: string) => void,
  ) => (
    <Box
      key={item.id}
      className={[
        classes.innerTab,
        currentTab === item.id && classes.innerTabActive,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onSelect(item.id)}
      role="tab"
      aria-selected={currentTab === item.id}
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(item.id);
        }
      }}
    >
      {item.label}
      {item.count !== undefined && (
        <span className={classes.innerTabCount}>{item.count}</span>
      )}
    </Box>
  );

  return (
    <VerticalTabNav
      tabs={outerTabs}
      activeTabId={outerSection}
      onChange={handleOuterTabChange}
      className={classes.outerNav}
    >
      {/* ===== WORKLOAD SECTION ===== */}
      {outerSection === 'workload' && (
        <Box className={classes.sectionContent}>
          {/* Inner panel */}
          <Box className={classes.innerPanel}>
            {/* Tab bar with Form/YAML toggle on the right */}
            <Box className={classes.innerTabs} role="tablist">
              {!isYamlMode &&
                workloadNavItems.map(item =>
                  renderInnerTab(item, activeTab, setActiveTab),
                )}
              {isYamlMode && (
                <Typography
                  variant="body2"
                  color="textSecondary"
                  style={{ padding: '10px 8px', fontSize: 13 }}
                >
                  YAML Editor
                </Typography>
              )}
              <Box className={classes.innerTabsSpacer} />
              <FormYamlToggle
                value={isYamlMode ? 'yaml' : 'form'}
                onChange={handleModeToggle}
                disabled={isDeploying}
              />
            </Box>

            {!isYamlMode ? (
              <>
                {/* Form content */}
                <Box className={classes.innerContent}>
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
                  {activeTab === 'dependencies' && (
                    <DependencyContent
                      disabled={isDeploying}
                      dependencies={formData.dependencies?.endpoints || []}
                      onDependencyReplace={handleDependencyReplace}
                      onAddDependency={addDependency}
                      onRemoveDependency={removeDependency}
                    />
                  )}
                </Box>
              </>
            ) : (
              /* YAML editor - full width inside the panel */
              <Box className={classes.yamlEditorContainer}>
                {yamlError && (
                  <Typography className={classes.yamlError}>
                    {yamlError}
                  </Typography>
                )}
                <YamlEditor
                  content={yamlContent}
                  onChange={handleYamlChange}
                  errorText={yamlError}
                  readOnly={isDeploying}
                />
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* ===== COMPONENT SECTION ===== */}
      {outerSection === 'component' && (
        <Box className={classes.sectionContent}>
          <Box className={classes.innerPanel}>
            {/* Show tabs when multiple sub-tabs, or a title header when only one */}
            {componentNavItems.length > 1 ? (
              <Box className={classes.innerTabs} role="tablist">
                {componentNavItems.map(item =>
                  renderInnerTab(item, activeTab, setActiveTab),
                )}
              </Box>
            ) : (
              <Box className={classes.innerTabs}>
                <Typography
                  variant="subtitle2"
                  style={{ padding: '0 8px', fontSize: 13, fontWeight: 600 }}
                >
                  {componentNavItems[0]?.label}
                </Typography>
              </Box>
            )}

            {/* Content */}
            <Box className={classes.innerContent}>
              {activeTab === 'parameters' &&
                hasParameters &&
                parametersSchema &&
                onParametersChange && (
                  <ParametersContent
                    schema={parametersSchema}
                    parameters={parameters || {}}
                    onChange={onParametersChange}
                    disabled={isDeploying}
                  />
                )}
              {activeTab === 'traits' &&
                traitsState &&
                onAddTrait &&
                onEditTrait &&
                onDeleteTrait &&
                onUndoDeleteTrait && (
                  <TraitsContent
                    traitsState={traitsState}
                    onAdd={onAddTrait}
                    onEdit={onEditTrait}
                    onDelete={onDeleteTrait}
                    onUndo={onUndoDeleteTrait}
                    allowedTraits={allowedTraits ?? undefined}
                    disabled={isDeploying}
                  />
                )}
            </Box>
          </Box>
        </Box>
      )}
    </VerticalTabNav>
  );
}
