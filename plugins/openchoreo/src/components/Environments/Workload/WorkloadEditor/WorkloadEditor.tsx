import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { Box, Button, IconButton, Typography } from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import CloseIcon from '@material-ui/icons/Close';
import { FormYamlToggle } from '@openchoreo/backstage-design-system';
import YAML from 'yaml';
import type {
  Container,
  WorkloadEndpoint,
  EnvVar,
  FileVar,
  Dependency,
  ResourceDependency,
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
import type { ComponentEndpointsState } from '../hooks/useComponentEndpoints';
import { endpointCards } from '../componentEndpointDrafts';
import {
  endpointToYaml,
  endpointYamlTabs,
  newEndpointTemplate,
  parseEndpointYaml,
  type EndpointYamlEdit,
} from '../endpointYaml';

/** A new Endpoint being written in the YAML editor, not yet staged. */
interface EndpointDraft {
  id: string;
  text: string;
  /** The template it started from, for telling the fixed fields apart. */
  shown: Record<string, unknown>;
  /** Why it can't be staged yet. */
  error?: string;
}
import { useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

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
  /** The component's own Endpoints, edited alongside its workload endpoints. */
  componentEndpoints?: ComponentEndpointsState;
  endpointChangesCount?: number;
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
  yamlAddEndpoint: {
    alignSelf: 'center',
    marginLeft: theme.spacing(1),
    whiteSpace: 'nowrap',
  },
  yamlNotice: {
    margin: theme.spacing(2, 2, 0),
  },
  yamlPending: {
    color: theme.palette.warning.dark,
    fontSize: '0.75rem',
    marginBottom: theme.spacing(1),
  },
  innerTabRemove: {
    marginLeft: theme.spacing(0.5),
    padding: 2,
    fontSize: 14,
  },
  yamlHint: {
    color: theme.palette.text.secondary,
    fontSize: '0.75rem',
    marginBottom: theme.spacing(1),
  },
  yamlError: {
    color: theme.palette.error.main,
    fontSize: '0.75rem',
    marginBottom: theme.spacing(1),
  },
}));

/** The YAML editor's Workload tab; each Endpoint tab is `endpoint:<name>`. */
const WORKLOAD_YAML_TAB = 'workload';

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
  componentEndpoints,
  endpointChangesCount = 0,
}: WorkloadEditorProps) {
  const classes = useStyles();
  const {
    workloadResource,
    setWorkloadResource,
    isDeploying,
    setEditingSection,
  } = useWorkloadContext();
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

  // In YAML mode the editor has a tab for the Workload and one for each of
  // the component's Endpoints. An Endpoint's tab edits its visibility and
  // parameters, which go back into the form's staged changes.
  const { entity } = useEntity();
  const yamlContext = useMemo(() => {
    const annotations = entity.metadata.annotations ?? {};
    return {
      componentName:
        annotations[CHOREO_ANNOTATIONS.COMPONENT] ?? entity.metadata.name,
      projectName: annotations[CHOREO_ANNOTATIONS.PROJECT] ?? '',
      namespaceName: annotations[CHOREO_ANNOTATIONS.NAMESPACE] ?? '',
    };
  }, [entity]);
  const endpointTabs = useMemo(
    () =>
      componentEndpoints && !hideEndpoints
        ? endpointYamlTabs(
            workloadResource?.spec?.endpoints ?? {},
            componentEndpoints,
            yamlContext,
          )
        : [],
    [componentEndpoints, hideEndpoints, workloadResource, yamlContext],
  );
  const [yamlTab, setYamlTab] = useState(WORKLOAD_YAML_TAB);
  const [endpointYaml, setEndpointYaml] = useState('');
  const [endpointYamlError, setEndpointYamlError] = useState<
    string | undefined
  >();
  const activeEndpointTab = endpointTabs.find(
    t => `endpoint:${t.workloadEndpoint}` === yamlTab,
  );
  const [drafts, setDrafts] = useState<EndpointDraft[]>([]);
  const draftCount = useRef(0);
  const activeDraft = drafts.find(d => `draft:${d.id}` === yamlTab);
  const [yamlNotice, setYamlNotice] = useState<string | undefined>();

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

  /**
   * Patch one or more fields of `spec.dependencies` while preserving every
   * other field. Callers pass `{ endpoints }` or `{ resources }` and the
   * other side survives. Without this merge, wholesale-replacing
   * `dependencies` from a single-key patch drops the other side on save.
   */
  const updateDependencies = useCallback(
    (patch: { endpoints?: Dependency[]; resources?: ResourceDependency[] }) => {
      updateSpec({
        ...formData,
        dependencies: { ...formData.dependencies, ...patch },
      } as WorkloadSpec);
    },
    [formData, updateSpec],
  );

  const handleContainerChange = (field: keyof Container, value: any) => {
    if (!formData.container) return;
    updateContainer({ ...formData.container, [field]: value } as Container);
  };

  const handleContainerEditingChange = useCallback(
    (editing: boolean) => {
      setEditingSection('container', editing);
    },
    [setEditingSection],
  );

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
    const inEndpointsForm = componentEndpoints?.mode === 'endpoints';
    const endpointName = `endpoint-${
      Object.keys(formData.endpoints || {}).length + 1
    }`;
    const updatedEndpoints = {
      ...formData.endpoints,
      // In the Endpoints form a row takes visibility beyond project only
      // with an Endpoint, so a new row starts within the project.
      [endpointName]: {
        type: 'HTTP',
        port: 8080,
        visibility: inEndpointsForm ? ['project'] : ['external'],
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
    updateDependencies({ endpoints: updatedEndpoints });
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
    updateDependencies({ endpoints: updatedEndpoints });
    return updatedEndpoints.length - 1;
  };

  const removeDependency = (index: number) => {
    const updatedEndpoints = (formData.dependencies?.endpoints || []).filter(
      (_, i) => i !== index,
    );
    updateDependencies({ endpoints: updatedEndpoints });
  };

  const handleResourceDependencyReplace = (
    index: number,
    resource: ResourceDependency,
  ) => {
    const currentResources = formData.dependencies?.resources || [];
    const updatedResources = [...currentResources];
    updatedResources[index] = resource;
    updateDependencies({ resources: updatedResources });
  };

  const addResourceDependency = (ref: string): number => {
    const newResource: ResourceDependency = { ref };
    const currentResources = formData.dependencies?.resources || [];
    const updatedResources = [...currentResources, newResource];
    updateDependencies({ resources: updatedResources });
    return updatedResources.length - 1;
  };

  const removeResourceDependency = (index: number) => {
    const updatedResources = (formData.dependencies?.resources || []).filter(
      (_, i) => i !== index,
    );
    updateDependencies({ resources: updatedResources });
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
        setYamlTab(WORKLOAD_YAML_TAB);
        setEndpointYamlError(undefined);
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
      } else if (newMode === 'form' && isYamlMode && drafts.length > 0) {
        setYamlNotice(
          'Finish or remove the new Endpoints before switching to Form view.',
        );
      } else if (newMode === 'form' && isYamlMode && activeEndpointTab) {
        // An Endpoint tab's edits are already in the form's state.
        if (endpointYamlError) {
          setEndpointYamlError(
            'Fix the Endpoint YAML errors before switching to Form view',
          );
          return;
        }
        setYamlWarning(undefined);
        setIsYamlMode(false);
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
      activeEndpointTab,
      endpointYamlError,
      drafts.length,
    ],
  );

  // New Endpoints written in YAML mode: each starts as a draft tab with an
  // Endpoint template, and joins the form's staged changes (as its workload
  // endpoint's Endpoint tab) once it names a workload endpoint of the
  // Workload tab that has no Endpoint. Saving waits while drafts remain.
  const canAddEndpoint =
    componentEndpoints?.mode === 'endpoints' && !hideEndpoints;
  // The tab to open on its regenerated YAML once it exists.
  const pendingEndpointTab = useRef<string | null>(null);

  useEffect(() => {
    setEditingSection('endpointYaml', drafts.length > 0);
  }, [drafts.length, setEditingSection]);
  useEffect(
    () => () => setEditingSection('endpointYaml', false),
    [setEditingSection],
  );

  // Workload endpoints a new Endpoint may route to: those without one.
  const freeWorkloadEndpoints = useMemo(
    () =>
      Object.keys(workloadResource?.spec?.endpoints ?? {}).filter(
        name => !endpointTabs.some(t => t.workloadEndpoint === name),
      ),
    [workloadResource, endpointTabs],
  );

  /**
   * Stages an Endpoint read from YAML on its workload endpoint: its type and
   * parameters as the endpoint's choice, its visibility on the endpoint.
   * Moving it from another workload endpoint leaves that one project-only.
   */
  const stageEndpoint = (
    edit: EndpointYamlEdit,
    typeKey: string,
    workloadEndpoint: string,
    from?: string,
  ) => {
    if (!componentEndpoints || !workloadResource) return;
    const endpoints = { ...workloadResource.spec?.endpoints };
    if (from && from !== workloadEndpoint && endpoints[from]) {
      endpoints[from] = { ...endpoints[from], visibility: ['project'] };
      componentEndpoints.restoreChoice(from, undefined);
    }
    const current = endpoints[workloadEndpoint];
    if (
      current &&
      JSON.stringify(current.visibility ?? []) !==
        JSON.stringify(edit.visibility)
    ) {
      endpoints[workloadEndpoint] = {
        ...current,
        visibility: edit.visibility as WorkloadEndpoint['visibility'],
      };
    }
    setWorkloadResource({
      ...workloadResource,
      spec: { ...workloadResource.spec, endpoints },
    } as WorkloadResource);
    componentEndpoints.setChoice(workloadEndpoint, {
      type: typeKey,
      parameters: edit.parameters,
    });
  };

  /** Stages a draft once its YAML is complete; reports why it isn't. */
  const tryStageDraft = (draft: EndpointDraft, text: string) => {
    const edit = parseEndpointYaml(text, draft.shown, {
      isNew: true,
      allowedEndpoints: componentEndpoints?.allowedEndpoints,
      freeWorkloadEndpoints,
      componentName: yamlContext.componentName,
    });
    if ('error' in edit) {
      setDrafts(prev =>
        prev.map(d =>
          d.id === draft.id ? { ...d, text, error: edit.error } : d,
        ),
      );
      return;
    }
    const name = edit.workloadEndpoint!;
    stageEndpoint(edit, edit.typeKey!, name);
    setDrafts(prev => prev.filter(d => d.id !== draft.id));
    pendingEndpointTab.current = name;
    setYamlTab(`endpoint:${name}`);
  };

  const yamlTabHasErrors = () => {
    if (yamlTab === WORKLOAD_YAML_TAB && yamlError) {
      setYamlError('Fix YAML errors before leaving this tab');
      return true;
    }
    if (activeEndpointTab && endpointYamlError) {
      setEndpointYamlError(
        'Fix the Endpoint YAML errors before leaving this tab',
      );
      return true;
    }
    return false;
  };

  const addEndpointDraft = () => {
    if (yamlTabHasErrors()) return;
    if (!componentEndpoints) return;
    draftCount.current += 1;
    const shown = newEndpointTemplate(
      componentEndpoints,
      yamlContext,
      undefined,
    );
    const draft: EndpointDraft = {
      id: String(draftCount.current),
      text: endpointToYaml(shown),
      shown,
    };
    setDrafts(prev => [...prev, draft]);
    setYamlNotice(undefined);
    setYamlTab(`draft:${draft.id}`);
  };

  // Removing an Endpoint's tab deletes the Endpoint on save; its workload
  // endpoint stays, within the project, to be removed in the Workload tab.
  const removeEndpointTab = (name: string) => {
    if (!componentEndpoints || !workloadResource?.spec?.endpoints?.[name]) {
      return;
    }
    const endpoints = workloadResource.spec.endpoints;
    setWorkloadResource({
      ...workloadResource,
      spec: {
        ...workloadResource.spec,
        endpoints: {
          ...endpoints,
          [name]: { ...endpoints[name], visibility: ['project'] },
        },
      },
    } as WorkloadResource);
    componentEndpoints.restoreChoice(name, undefined);
    if (yamlTab === `endpoint:${name}`) setEndpointYamlError(undefined);
  };

  const removeDraft = (id: string) =>
    setDrafts(prev => prev.filter(d => d.id !== id));

  // Switching YAML tabs: each tab opens on the resource as it is now, so
  // edits made in another tab show. A Workload or Endpoint tab with errors
  // can't be left; a draft can, to add its workload endpoint.

  const selectYamlTab = (id: string) => {
    if (id === yamlTab || yamlTabHasErrors()) return;
    setYamlNotice(undefined);
    if (id === WORKLOAD_YAML_TAB) {
      setYamlContent(resourceToYaml(workloadResource));
      setYamlError(undefined);
    } else if (id.startsWith('draft:')) {
      const draft = drafts.find(d => `draft:${d.id}` === id);
      if (!draft) return;
      setYamlTab(id);
      // The Workload tab may now have the workload endpoint it names.
      tryStageDraft(draft, draft.text);
      return;
    } else {
      const tab = endpointTabs.find(
        t => `endpoint:${t.workloadEndpoint}` === id,
      );
      if (!tab) return;
      setEndpointYaml(endpointToYaml(tab.resource));
      setEndpointYamlError(undefined);
    }
    setYamlTab(id);
  };

  // A staged or moved Endpoint's tab opens on its YAML once it exists.
  useEffect(() => {
    const pending = pendingEndpointTab.current;
    if (pending && activeEndpointTab?.workloadEndpoint === pending) {
      pendingEndpointTab.current = null;
      setEndpointYaml(endpointToYaml(activeEndpointTab.resource));
      setEndpointYamlError(undefined);
    }
  }, [activeEndpointTab]);

  // Back to the Workload tab when the shown tab goes away.
  useEffect(() => {
    if (pendingEndpointTab.current || yamlTab === WORKLOAD_YAML_TAB) return;
    if (!activeEndpointTab && !activeDraft) {
      setYamlTab(WORKLOAD_YAML_TAB);
      setYamlContent(resourceToYaml(workloadResource));
    }
  }, [yamlTab, activeEndpointTab, activeDraft, workloadResource]);

  const handleEndpointYamlChange = (content: string) => {
    setEndpointYaml(content);
    if (!activeEndpointTab || !componentEndpoints) return;
    const tab = activeEndpointTab;
    const edit = parseEndpointYaml(content, tab.resource, {
      isNew: tab.isNew,
      allowedEndpoints: componentEndpoints.allowedEndpoints,
      freeWorkloadEndpoints: [...freeWorkloadEndpoints, tab.workloadEndpoint],
      componentName: yamlContext.componentName,
    });
    if ('error' in edit) {
      setEndpointYamlError(edit.error);
      return;
    }
    setEndpointYamlError(undefined);
    const name = edit.workloadEndpoint ?? tab.workloadEndpoint;
    stageEndpoint(
      edit,
      edit.typeKey ?? tab.typeKey,
      name,
      tab.workloadEndpoint,
    );
    // Moved to another workload endpoint: its tab follows, renamed.
    if (name !== tab.workloadEndpoint) {
      pendingEndpointTab.current = name;
      setYamlTab(`endpoint:${name}`);
    }
  };

  const handleDraftChange = (content: string) => {
    if (activeDraft) tryStageDraft(activeDraft, content);
  };

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
  const hasWorkloadChanges =
    (workloadChanges?.hasChanges ?? false) || endpointChangesCount > 0;
  const traitChangesCount = traitsState
    ? traitsState.filter(t => t.state !== 'original').length
    : 0;
  const hasComponentChanges =
    traitChangesCount > 0 || parameterChangesCount > 0;

  // --- Inner nav items with counts ---

  // The Endpoints tab's count follows what it lists.
  const endpointCount = Object.keys(
    endpointCards(
      formData.endpoints || {},
      componentEndpoints?.mode,
      componentEndpoints?.deprecatedRows,
    ),
  ).length;
  const dependencyCount =
    (formData.dependencies?.endpoints || []).length +
    (formData.dependencies?.resources || []).length;

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
    item: {
      id: string;
      label: string;
      count?: number;
      /** Removes what the tab shows; adds a ✕ to the tab. */
      onRemove?: () => void;
    },
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
      {item.onRemove && (
        <IconButton
          size="small"
          className={classes.innerTabRemove}
          aria-label={`Remove ${item.label}`}
          disabled={isDeploying}
          onClick={e => {
            e.stopPropagation();
            item.onRemove?.();
          }}
          onKeyDown={e => e.stopPropagation()}
        >
          <CloseIcon fontSize="inherit" />
        </IconButton>
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
              {isYamlMode &&
                canAddEndpoint &&
                [
                  { id: WORKLOAD_YAML_TAB, label: 'Workload' },
                  ...endpointTabs.map(t => ({
                    id: `endpoint:${t.workloadEndpoint}`,
                    label: `Endpoint: ${t.label}`,
                    onRemove: () => removeEndpointTab(t.workloadEndpoint),
                  })),
                  ...drafts.map((d, i) => ({
                    id: `draft:${d.id}`,
                    label:
                      drafts.length > 1
                        ? `New Endpoint ${i + 1}`
                        : 'New Endpoint',
                    onRemove: () => removeDraft(d.id),
                  })),
                ].map(item => renderInnerTab(item, yamlTab, selectYamlTab))}
              {isYamlMode && canAddEndpoint && (
                <Button
                  size="small"
                  color="primary"
                  startIcon={<AddIcon />}
                  className={classes.yamlAddEndpoint}
                  disabled={isDeploying}
                  onClick={addEndpointDraft}
                >
                  Add Endpoint
                </Button>
              )}
              {isYamlMode && !canAddEndpoint && (
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
                      onEditingChange={handleContainerEditingChange}
                    />
                  )}
                  {activeTab === 'endpoints' && (
                    <EndpointContent
                      disabled={isDeploying}
                      endpoints={formData.endpoints || {}}
                      onEndpointReplace={handleEndpointReplace}
                      onAddEndpoint={addEndpoint}
                      onRemoveEndpoint={removeEndpoint}
                      componentEndpoints={componentEndpoints}
                    />
                  )}
                  {activeTab === 'dependencies' && (
                    <DependencyContent
                      disabled={isDeploying}
                      dependencies={formData.dependencies?.endpoints || []}
                      resources={formData.dependencies?.resources || []}
                      onDependencyReplace={handleDependencyReplace}
                      onAddDependency={addDependency}
                      onRemoveDependency={removeDependency}
                      onResourceDependencyReplace={
                        handleResourceDependencyReplace
                      }
                      onAddResourceDependency={addResourceDependency}
                      onRemoveResourceDependency={removeResourceDependency}
                    />
                  )}
                </Box>
              </>
            ) : (
              /* YAML editor - full width inside the panel: the Workload or
                 one of the component's Endpoints */
              <>
                {yamlNotice && (
                  <Alert severity="warning" className={classes.yamlNotice}>
                    {yamlNotice}
                  </Alert>
                )}
                {activeDraft && (
                  <Box className={classes.yamlEditorContainer}>
                    <Typography className={classes.yamlHint}>
                      Write the new Endpoint, and add the workload endpoint it
                      routes to (spec.backendRefs[0].component.endpoint) under
                      spec.endpoints in the Workload tab.{' '}
                      {freeWorkloadEndpoints.length > 0
                        ? `Workload endpoints without an Endpoint: ${freeWorkloadEndpoints.join(
                            ', ',
                          )}.`
                        : 'Every workload endpoint has an Endpoint.'}{' '}
                      The name is set on save.
                    </Typography>
                    {activeDraft.error && (
                      <Typography className={classes.yamlPending}>
                        {activeDraft.error}
                      </Typography>
                    )}
                    <YamlEditor
                      content={activeDraft.text}
                      onChange={handleDraftChange}
                      readOnly={isDeploying}
                    />
                  </Box>
                )}
                {!activeDraft && activeEndpointTab && (
                  <Box className={classes.yamlEditorContainer}>
                    <Typography className={classes.yamlHint}>
                      {activeEndpointTab.isNew
                        ? 'spec.type, spec.visibility, spec.parameters and the workload endpoint in spec.backendRefs can be changed here. The name is set on save.'
                        : 'Only spec.visibility and spec.parameters can be changed here.'}{' '}
                      Changes are saved with the workload.
                    </Typography>
                    {endpointYamlError && (
                      <Typography className={classes.yamlError}>
                        {endpointYamlError}
                      </Typography>
                    )}
                    <YamlEditor
                      content={endpointYaml}
                      onChange={handleEndpointYamlChange}
                      errorText={endpointYamlError}
                      readOnly={isDeploying}
                    />
                  </Box>
                )}
                {!activeDraft && !activeEndpointTab && (
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
              </>
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
