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
  publicVirtualHost?: string;
  namespaceVirtualHost?: string;
  publicHTTPPort?: number;
  publicHTTPSPort?: number;
  namespaceHTTPPort?: number;
  namespaceHTTPSPort?: number;
  observabilityPlaneRef?: string;
  createdAt?: string;
  status?: string;
}

export interface DataPlaneWithEnvironments extends DataPlane {
  environments: Environment[];
}

export interface PlatformEnvironmentService {
  /**
   * Fetches all environments across all namespaces
   */
  fetchAllEnvironments(userToken?: string): Promise<Environment[]>;

  /**
   * Fetches environments for a specific namespace
   */
  fetchEnvironmentsByNamespace(
    namespaceName: string,
    userToken?: string,
  ): Promise<Environment[]>;

  /**
   * Fetches all dataplanes across all namespaces
   */
  fetchAllDataplanes(userToken?: string): Promise<DataPlane[]>;

  /**
   * Fetches dataplanes for a specific namespace
   */
  fetchDataplanesByNamespace(
    namespaceName: string,
    userToken?: string,
  ): Promise<DataPlane[]>;

  /**
   * Fetches all dataplanes with their associated environments
   */
  fetchDataplanesWithEnvironments(
    userToken?: string,
  ): Promise<DataPlaneWithEnvironments[]>;

  /**
   * Fetches all dataplanes with their associated environments and component counts
   */
  fetchDataplanesWithEnvironmentsAndComponentCounts(
    userToken?: string,
  ): Promise<DataPlaneWithEnvironments[]>;

  /**
   * Fetches component counts per environment using bindings API
   */
  fetchComponentCountsPerEnvironment(
    components: Array<{
      namespaceName: string;
      projectName: string;
      componentName: string;
    }>,
    userToken?: string,
  ): Promise<Map<string, number>>;

  /**
   * Fetches count of distinct components that have at least one binding (deployment)
   */
  fetchDistinctDeployedComponentsCount(
    components: Array<{
      namespaceName: string;
      projectName: string;
      componentName: string;
    }>,
    userToken?: string,
  ): Promise<number>;

  /**
   * Fetches count of healthy workloads across all components
   * A workload is considered healthy if its status.status === 'Active'
   */
  fetchHealthyWorkloadCount(
    components: Array<{
      namespaceName: string;
      projectName: string;
      componentName: string;
    }>,
    userToken?: string,
  ): Promise<number>;
}
