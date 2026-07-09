import { Project } from '@openchoreo/cell-diagram';
import type { ObservabilityComponents } from '@openchoreo/openchoreo-client-node';
import type {
  WorkloadResource,
  ReleaseBindingCondition,
} from '@openchoreo/backstage-plugin-common';
import type { ModelsSecretReferences } from './services/SecretReferencesService/SecretReferencesService';
import type {
  SecretResponse,
  SecretsListResponse,
  SecretDetail,
  CreateSecretRequest,
  UpdateSecretRequest,
} from './services/SecretsService/SecretsService';

// Log types from the unified /api/v1/logs/query endpoint
export type LogEntry = ObservabilityComponents['schemas']['ComponentLogEntry'];
export type RuntimeLogsResponse = {
  logs: ObservabilityComponents['schemas']['ComponentLogEntry'][];
  total?: number;
  tookMs?: number;
};

export interface EnvironmentService {
  fetchDeploymentInfo(request: {
    projectName: string;
    componentName: string;
    namespaceName: string;
  }): Promise<Environment[]>;

  promoteComponent(request: {
    sourceEnvironment: string;
    targetEnvironment: string;
    componentName: string;
    projectName: string;
    namespaceName: string;
  }): Promise<Environment[]>;

  updateComponentBinding(request: {
    componentName: string;
    projectName: string;
    namespaceName: string;
    bindingName: string;
    releaseState: 'Active' | 'Suspend' | 'Undeploy';
  }): Promise<Environment[]>;

  fetchResourceEnvironmentInfo(request: {
    resourceName: string;
    projectName: string;
    namespaceName: string;
  }): Promise<ResourceEnvironment[]>;

  updateResourceReleaseBinding(request: {
    resourceName: string;
    projectName: string;
    namespaceName: string;
    environment: string;
    releaseName: string;
    retainPolicy?: 'Delete' | 'Retain';
    resourceTypeEnvironmentConfigs?: any;
  }): Promise<unknown>;

  deleteResourceReleaseBinding(request: {
    resourceName: string;
    projectName: string;
    namespaceName: string;
    environment: string;
  }): Promise<unknown>;

  fetchProjectEnvironmentInfo(request: {
    projectName: string;
    namespaceName: string;
  }): Promise<ProjectEnvironment[]>;

  updateProjectReleaseBinding(request: {
    projectName: string;
    namespaceName: string;
    environment: string;
    releaseName: string;
    environmentConfigs?: any;
  }): Promise<unknown>;
}

export interface EndpointURLDetails {
  host: string;
  path?: string;
  port: number;
  scheme: string;
}

export interface EndpointInfo {
  name: string;
  type?: string;
  externalURLs?: Record<string, EndpointURLDetails>;
  internalURLs?: Record<string, EndpointURLDetails>;
  serviceURL?: EndpointURLDetails;
}

export interface Environment {
  uid?: string;
  name: string;
  resourceName?: string;
  bindingName?: string;
  /**
   * Whether the owning project is deployed in this environment (its cell
   * namespace exists), which a component requires before it can run here.
   * Derived from the project's ProjectReleaseBinding `NamespaceReady`
   * condition. `ready` — namespace exists; `pending` — binding exists but the
   * namespace isn't ready yet; `not-deployed` — no project binding for this
   * env. Absent when the project-deployment check could not run (treated as
   * deployed by the UI, fail-open).
   */
  projectDeploymentStatus?: 'ready' | 'pending' | 'not-deployed';
  hasComponentTypeOverrides?: boolean;
  dataPlaneRef?: string;
  dataPlaneKind?: 'DataPlane' | 'ClusterDataPlane';
  deployment: {
    status?: 'Ready' | 'NotReady' | 'Failed' | undefined;
    statusReason?: string;
    statusMessage?: string;
    /** Raw Ready/other conditions from the ReleaseBinding, for surfacing the
     *  controller's failure reason + message in the deploy UI. */
    conditions?: ReleaseBindingCondition[];
    lastDeployed?: string;
    image?: string;
    releaseName?: string;
  };
  endpoints: EndpointInfo[];
  promotionTargets?: {
    name: string;
    resourceName?: string;
  }[];
}

export interface ResourceBindingOutput {
  name: string;
  value?: string;
  secretKeyRef?: { name: string; key: string };
  configMapKeyRef?: { name: string; key: string };
}

/**
 * Per-environment view of a Resource's runtime state. One entry per
 * environment in the project's deployment pipeline, including
 * environments where no ResourceReleaseBinding exists yet (so the UI
 * can render a Deploy affordance against them).
 */
export interface ResourceEnvironment {
  uid?: string;
  name: string;
  resourceName?: string;
  dataPlaneRef?: string;
  dataPlaneKind?: 'DataPlane' | 'ClusterDataPlane';
  bindingName?: string;
  resourceRelease?: string;
  retainPolicy?: 'Delete' | 'Retain';
  status?: 'Ready' | 'NotReady' | 'Failed';
  statusReason?: string;
  statusMessage?: string;
  lastDeployed?: string;
  outputs?: ResourceBindingOutput[];
  promotionTargets?: {
    name: string;
    resourceName?: string;
  }[];
  /** Latest ResourceRelease cut by the Resource controller, if any. */
  latestRelease?: string;
}

/**
 * Per-environment view of a Project's deploy state. One entry per environment
 * in the project's deployment pipeline, including environments where no
 * ProjectReleaseBinding exists yet (so the UI can render a Deploy affordance
 * against them).
 */
export interface ProjectEnvironment {
  uid?: string;
  name: string;
  resourceName?: string;
  dataPlaneRef?: string;
  dataPlaneKind?: 'DataPlane' | 'ClusterDataPlane';
  bindingName?: string;
  /** The ProjectRelease pinned to this environment (binding.spec.projectRelease). */
  projectRelease?: string;
  status?: 'Ready' | 'NotReady' | 'Failed';
  statusReason?: string;
  statusMessage?: string;
  lastDeployed?: string;
  /** The data-plane namespace owned by this binding (binding.status.namespace). */
  namespace?: string;
  promotionTargets?: {
    name: string;
    resourceName?: string;
  }[];
  /** Latest ProjectRelease cut by the Project controller, if any. */
  latestRelease?: string;
}

export type ObjectToFetch = {
  group: string;
  apiVersion: string;
  plural: string;
  objectType: 'customresources';
};

export const environmentChoreoWorkflowTypes: ObjectToFetch[] = [
  {
    group: 'core.choreo.dev',
    apiVersion: 'v1',
    plural: 'environments',
    objectType: 'customresources',
  },
  {
    group: 'core.choreo.dev',
    apiVersion: 'v1',
    plural: 'deployments',
    objectType: 'customresources',
  },
  {
    group: 'core.choreo.dev',
    apiVersion: 'v1',
    plural: 'endpoints',
    objectType: 'customresources',
  },
];

export const cellChoreoWorkflowTypes: ObjectToFetch[] = [
  {
    group: 'core.choreo.dev',
    apiVersion: 'v1',
    plural: 'projects',
    objectType: 'customresources',
  },
  {
    group: 'core.choreo.dev',
    apiVersion: 'v1',
    plural: 'components',
    objectType: 'customresources',
  },
  {
    group: 'core.choreo.dev',
    apiVersion: 'v1',
    plural: 'endpoints',
    objectType: 'customresources',
  },
];

export interface CellDiagramService {
  fetchProjectInfo(
    request: {
      projectName: string;
      namespaceName: string;
      environmentName?: string;
      startTime?: string;
      endTime?: string;
    },
    token?: string,
  ): Promise<Project | undefined>;
}

export interface WorkloadService {
  fetchWorkloadInfo(
    request: {
      projectName: string;
      componentName: string;
      namespaceName: string;
    },
    token?: string,
  ): Promise<WorkloadResource | null>;

  applyWorkload(
    request: {
      projectName: string;
      componentName: string;
      namespaceName: string;
      workload: WorkloadResource;
      isNew: boolean;
    },
    token?: string,
  ): Promise<WorkloadResource>;
}

export interface RuntimeLogsService {
  fetchRuntimeLogs(
    request: {
      componentName: string;
      environmentName: string;
      logLevels?: ('DEBUG' | 'INFO' | 'WARN' | 'ERROR')[];
      startTime?: string;
      endTime?: string;
      limit?: number;
      offset?: number;
    },
    namespaceName: string,
    projectName: string,
    token?: string,
  ): Promise<RuntimeLogsResponse>;
}

export interface SecretReferencesService {
  fetchSecretReferences(
    namespaceName: string,
    token?: string,
  ): Promise<ModelsSecretReferences>;
}

export interface SecretsService {
  listSecrets(
    namespaceName: string,
    token?: string,
  ): Promise<SecretsListResponse>;
  getSecret(
    namespaceName: string,
    secretName: string,
    token?: string,
  ): Promise<SecretDetail>;
  createSecret(
    namespaceName: string,
    body: CreateSecretRequest,
    userToken?: string,
  ): Promise<SecretResponse>;
  updateSecret(
    namespaceName: string,
    secretName: string,
    body: UpdateSecretRequest,
    userToken?: string,
  ): Promise<SecretResponse>;
  deleteSecret(
    namespaceName: string,
    secretName: string,
    userToken?: string,
  ): Promise<void>;
}

// LogEntry and RuntimeLogsResponse are now imported from the generated observability client
// See @openchoreo/openchoreo-client-node/src/generated/observability/types
