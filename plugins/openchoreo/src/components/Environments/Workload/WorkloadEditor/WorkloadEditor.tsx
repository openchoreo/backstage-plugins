import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { Box, Typography } from '@material-ui/core';
import { FormYamlToggle } from '@openchoreo/backstage-design-system';
import YAML from 'yaml';
import type {
  Container,
  WorkloadEndpoint,
  EnvVar,
  FileVar,
  Dependency,
  WorkloadResource,
  WorkloadSpec,
} from '@openchoreo/backstage-plugin-common';
import { Alert } from '@material-ui/lab';
import { ContainerContent } from './ContainerContent';
import { EndpointContent } from './EndpointContent';
import { DependencyContent } from './DependencyContent';
import { TraitsContent } from './TraitsContent';
import { ParametersContent } from './ParametersContent';
import { useWorkloadContext } from '../WorkloadContext';
import {
  useSecretReferences,
  filterSecretReferencesForEnvDataPlane,
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
  componentTypeName?: string;
  /**
   * Data plane the workload will be deployed to. Used to filter the
   * secret-reference picker to refs whose value is reachable from this plane.
   */
  envDataPlane?: { kind?: string; name?: string };
  initialTab?: string;
  onTabChange?: (tab: string) => void;
  traitsState?: TraitWithState[];
  allowedTraits?: Array<{ kind?: string; name: string }> | null;
  onAddTrait?: (trait: ComponentTrait) => void;
  onEditTrait?: (instanceName: string, updated: ComponentTrait) => void;
  onDeleteTrait?: (instanceName: string) => void;
  onUndoDeleteTrait?: (instanceName: string) => void;
  hasTraitChanges?: boolean;
  traitsLoadError?: string | null;
  onRetryTraits?: () => void;
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
    padding: theme.spacing(3),
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
 * Serialize the full workload resource to YAML.
 */
function resourceToYaml(resource: WorkloadResource | null): string {
  if (!resource) return '';
  return YAML.stringify(resource, { indent: 2 });
}

/**
 * Parse YAML string back into a WorkloadResource.
 */
function yamlToResource(yamlStr: string): WorkloadResource | null {
  try {
    const parsed = YAML.parse(yamlStr);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed as WorkloadResource;
  } catch {
    return null;
  }
}

export function WorkloadEditor({
  componentTypeName,
  envDataPlane,
  initialTab,
  onTabChange,
  traitsState,
  allowedTraits,
  onAddTrait,
  onEditTrait,
  onDeleteTrait,
  onUndoDeleteTrait,
  hasTraitChanges: _hasTraitChanges,
  traitsLoadError,
  onRetryTraits,
  hasParameters,
  parametersSchema,
  parameters,
  onParametersChange,
  hasParameterChanges: _hasParameterChanges,
  workloadChanges,
  parameterChangesCount = 0,
}: WorkloadEditorProps) {
  const classes = useStyles();
  const { workloadResource, setWorkloadResource, isDeploying } =
    useWorkloadContext();
  const { secretReferences: allSecretReferences } = useSecretReferences();
  const secretReferences = useMemo(
    () =>
      filterSecretReferencesForEnvDataPlane(allSecretReferences, envDataPlane),
    [allSecretReferences, envDataPlane],
  );

  // Derive spec from the resource for form use
  const spec = workloadResource?.spec;

  // Local form buffer derived from spec — avoids re-rendering context on every keystroke
  const [formData, setFormData] = useState<WorkloadSpec>(() => spec ?? {});

  // Sync formData when the context resource changes (e.g. initial fetch, server response)
  useEffect(() => {
    if (spec) {
      setFormData(spec);
    }
  }, [spec]);

  // Determine if endpoints should be hidden (batch workloads like cronjob/job)
  const hideEndpoints = useMemo(() => {
    if (!componentTypeName) return false;
    const workloadType = componentTypeName.split('/')[0];
    return workloadType === 'cronjob' || workloadType === 'job';
  }, [componentTypeName]);

  // YAML mode state
  const [isYamlMode, setIsYamlMode] = useState(false);
  const [yamlContent, setYamlContent] = useState('');
  const [yamlError, setYamlError] = useState<string | undefined>();
  const [yamlWarning, setYamlWarning] = useState<string | undefined>();

  // Track last active sub-tab per section for smooth outer tab switching
  const lastWorkloadTabRef = useRef('container');
  const lastComponentTabRef = useRef<string | null>(null);

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

  // --- Helpers to update the resource via context ---

  /** Update spec fields in the resource. Merges the given spec into the current resource. */
  const updateSpec = useCallback(
    (updatedSpec: WorkloadSpec) => {
      setFormData(updatedSpec);
      setWorkloadResource(
        workloadResource
          ? { ...workloadResource, spec: updatedSpec }
          : ({ spec: updatedSpec } as WorkloadResource),
      );
    },
    [workloadResource, setWorkloadResource],
  );

  const updateContainer = (updated: Container) => {
    updateSpec({ ...formData, container: updated } as unknown as WorkloadSpec);
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
    const env = [...(formData.container.env || [])] as EnvVar[];
    env[envIndex] = { ...env[envIndex], [field]: value };
    updateContainer({ ...formData.container, env } as Container);
  };

  const handleEnvVarReplace = (envIndex: number, envVar: EnvVar) => {
    if (!formData.container) return;
    const env = [...(formData.container.env || [])] as EnvVar[];
    env[envIndex] = envVar;
    updateContainer({ ...formData.container, env } as Container);
  };

  const addEnvVar = () => {
    if (!formData.container) return;
    const env = [
      ...(formData.container.env || []),
      { key: '', value: '' },
    ] as EnvVar[];
    updateContainer({ ...formData.container, env } as Container);
  };

  const removeEnvVar = (envIndex: number) => {
    if (!formData.container) return;
    const env = (formData.container.env || []).filter(
      (_, i) => i !== envIndex,
    ) as EnvVar[];
    updateContainer({ ...formData.container, env } as Container);
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
    updateSpec({ ...formData, endpoints: updatedEndpoints } as WorkloadSpec);
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
    updateSpec({ ...formData, endpoints: updatedEndpoints } as WorkloadSpec);
    return endpointName;
  };

  const removeEndpoint = (endpointName: string) => {
    const updatedEndpoints = { ...formData.endpoints };
    delete updatedEndpoints[endpointName];
    updateSpec({ ...formData, endpoints: updatedEndpoints } as WorkloadSpec);
  };

  const handleDependencyReplace = (index: number, dependency: Dependency) => {
    const currentEndpoints = formData.dependencies?.endpoints || [];
    const updatedEndpoints = [...currentEndpoints];
    updatedEndpoints[index] = dependency as (typeof updatedEndpoints)[number];
    updateSpec({
      ...formData,
      dependencies: { endpoints: updatedEndpoints },
    } as WorkloadSpec);
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
    updateSpec({
      ...formData,
      dependencies: { endpoints: updatedEndpoints },
    } as WorkloadSpec);
    return updatedEndpoints.length - 1;
  };

  const removeDependency = (index: number) => {
    const updatedEndpoints = (formData.dependencies?.endpoints || []).filter(
      (_, i) => i !== index,
    );
    updateSpec({
      ...formData,
      dependencies: { endpoints: updatedEndpoints },
    } as WorkloadSpec);
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
        setYamlContent(resourceToYaml(workloadResource));
        setYamlError(undefined);
        if (
          hideEndpoints &&
          workloadResource?.spec?.endpoints &&
          Object.keys(workloadResource.spec.endpoints).length > 0
        ) {
          setYamlWarning(
            'Endpoints are not supported for CronJob/Job workload types',
          );
        } else {
          setYamlWarning(undefined);
        }
        setIsYamlMode(true);
      } else if (newMode === 'form' && isYamlMode) {
        const parsed = yamlToResource(yamlContent);
        if (parsed) {
          setWorkloadResource(parsed);
          setYamlError(undefined);
          setYamlWarning(undefined);
          setIsYamlMode(false);
        } else {
          setYamlError('Fix YAML errors before switching to Form view');
        }
      }
    },
    [
      isYamlMode,
      yamlContent,
      workloadResource,
      setWorkloadResource,
      hideEndpoints,
    ],
  );

  const handleYamlChange = useCallback(
    (content: string) => {
      setYamlContent(content);
      const parsed = yamlToResource(content);
      if (parsed) {
        setYamlError(undefined);
        setWorkloadResource(parsed);
        // Warn if endpoints are present for batch workload types
        if (
          hideEndpoints &&
          parsed.spec?.endpoints &&
          Object.keys(parsed.spec.endpoints).length > 0
        ) {
          setYamlWarning(
            'Endpoints are not supported for CronJob/Job workload types',
          );
        } else {
          setYamlWarning(undefined);
        }
      } else {
        setYamlError('Invalid YAML');
        setYamlWarning(undefined);
      }
    },
    [setWorkloadResource, hideEndpoints],
  );

  // --- Outer nav ---

  // Compute change indicators
  const hasWorkloadChanges = workloadChanges?.hasChanges ?? false;
  const traitChangesCount = traitsState
    ? traitsState.filter(t => t.state !== 'original').length
    : 0;
  const hasComponentChanges =
    traitChangesCount > 0 || parameterChangesCount > 0;

  // --- Inner nav items with counts ---

  const endpointCount = Object.keys(formData.endpoints || {}).length;
  const dependencyCount = (formData.dependencies?.endpoints || []).length;

  const workloadNavItems = useMemo(
    () =>
      WORKLOAD_NAV_IDS.filter(
        item => !(item.id === 'endpoints' && hideEndpoints),
      ).map(item => ({
        ...item,
        ...(item.id === 'endpoints' && { count: endpointCount }),
        ...(item.id === 'dependencies' && { count: dependencyCount }),
      })),
    [hideEndpoints, endpointCount, dependencyCount],
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

  const showComponentTab = componentNavItems.length > 0 || !!traitsLoadError;

  const outerTabs: TabItemData[] = useMemo(() => {
    const tabs: TabItemData[] = [
      {
        id: 'workload',
        label: 'Workload',
        icon: <SettingsIcon />,
        ...(hasWorkloadChanges && { status: 'info' as const }),
      },
    ];
    if (showComponentTab) {
      tabs.push({
        id: 'component',
        label: 'Component',
        icon: <MemoryIcon />,
        ...(hasComponentChanges && { status: 'info' as const }),
      });
    }
    return tabs;
  }, [hasWorkloadChanges, hasComponentChanges, showComponentTab]);

  const handleOuterTabChange = useCallback(
    (tabId: string) => {
      if (tabId === 'workload') {
        setActiveTab(lastWorkloadTabRef.current);
      } else {
        // Use last remembered tab if it's still valid, otherwise first available
        const validIds = new Set(componentNavItems.map(i => i.id));
        const target =
          lastComponentTabRef.current &&
          validIds.has(lastComponentTabRef.current)
            ? lastComponentTabRef.current
            : componentNavItems[0]?.id ?? 'component';
        setActiveTab(target);
      }
    },
    [setActiveTab, componentNavItems],
  );

  // Guard: redirect to a valid workload sub-tab (e.g. ?tab=endpoints on a CronJob)
  useEffect(() => {
    if (
      WORKLOAD_SUB_TABS.has(activeTab) &&
      !workloadNavItems.some(item => item.id === activeTab)
    ) {
      setActiveTab('container', true);
    }
  }, [activeTab, workloadNavItems, setActiveTab]);

  // Guard: redirect to a valid component sub-tab when the current activeTab
  // is in the component section but doesn't match any available item.
  useEffect(() => {
    if (
      !WORKLOAD_SUB_TABS.has(activeTab) &&
      componentNavItems.length > 0 &&
      !componentNavItems.some(item => item.id === activeTab)
    ) {
      setActiveTab(componentNavItems[0].id, true);
    }
  }, [activeTab, componentNavItems, setActiveTab]);

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
                      container={formData.container as Container | undefined}
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
                {yamlWarning && (
                  <Alert severity="warning" style={{ marginBottom: 8 }}>
                    {yamlWarning}
                  </Alert>
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
                (traitsLoadError ? (
                  <TraitsContent
                    traitsState={[]}
                    onAdd={() => {}}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    onUndo={() => {}}
                    disabled
                    loadError={traitsLoadError}
                    onRetry={onRetryTraits}
                  />
                ) : (
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
                  )
                ))}
            </Box>
          </Box>
        </Box>
      )}
    </VerticalTabNav>
  );
}
