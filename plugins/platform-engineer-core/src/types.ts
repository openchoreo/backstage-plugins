export interface Environment {
  name: string;
  namespace: string;
  displayName: string;
  description: string;
  namespaceName: string;
  dataPlaneRef: string;
  isProduction: boolean;
  dnsPrefix: string;
  createdAt: string;
  status: string;
  componentCount?: number;
}

export interface DataPlane {
  name: string;
  namespace?: string;
  displayName?: string;
  description?: string;
  namespaceName: string;
  imagePullSecretRefs?: string[];
  secretStoreRef?: string;
  kubernetesClusterName?: string;
  apiServerURL?: string;
  publicVirtualHost?: string;
  namespaceVirtualHost?: string;
  observerURL?: string;
  observerUsername?: string;
  createdAt?: string;
  status?: string;
  agentConnected?: boolean;
}

export interface DataPlaneWithEnvironments extends DataPlane {
  environments: Environment[];
}

export interface BuildPlane {
  name: string;
  namespace?: string;
  displayName?: string;
  description?: string;
  namespaceName: string;
  observabilityPlaneRef?: string;
  status?: string;
  agentConnected?: boolean;
  agentConnectedCount?: number;
}

export interface ObservabilityPlane {
  name: string;
  namespace?: string;
  displayName?: string;
  description?: string;
  namespaceName: string;
  observerURL?: string;
  status?: string;
  agentConnected?: boolean;
  agentConnectedCount?: number;
}
