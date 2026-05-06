import { Project } from '@wso2/cell-diagram';
import type { ObservabilityComponents } from '@openchoreo/openchoreo-client-node';
import type { WorkloadResource } from '@openchoreo/backstage-plugin-common';
import type { ModelsSecretReferences } from './services/SecretReferencesService/SecretReferencesService';
import type {
  GitSecretResponse,
  GitSecretListResponse,
} from './services/GitSecretsService/GitSecretsService';
import type {
  SecretResponse,
  SecretsListResponse,
  CreateSecretRequest,
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
  hasComponentTypeOverrides?: boolean;
  dataPlaneRef?: string;
  deployment: {
    status?: 'Ready' | 'NotReady' | 'Failed' | undefined;
    statusReason?: string;
    statusMessage?: string;
    lastDeployed?: string;
    image?: string;
    releaseName?: string;
  };
  endpoints: EndpointInfo[];
  promotionTargets?: {
    name: string;
    resourceName?: string;
    requiresApproval?: boolean;
    isManualApprovalRequired?: boolean;
  }[];
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

export interface GitSecretsService {
  listGitSecrets(
    namespaceName: string,
    token?: string,
  ): Promise<GitSecretListResponse>;
  createGitSecret(
    namespaceName: string,
    secretName: string,
    secretType: 'basic-auth' | 'ssh-auth',
    gitToken?: string,
    sshKey?: string,
    username?: string,
    sshKeyId?: string,
    userToken?: string,
    workflowPlaneKind?: string,
    workflowPlaneName?: string,
  ): Promise<GitSecretResponse>;
  deleteGitSecret(
    namespaceName: string,
    secretName: string,
    userToken?: string,
  ): Promise<void>;
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
  ): Promise<SecretResponse>;
  createSecret(
    namespaceName: string,
    body: CreateSecretRequest,
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
