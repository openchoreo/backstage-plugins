export interface Environment {
  name: string;
  namespace: string;
  displayName: string;
  description: string;
  organization: string;
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
  organization: string;
  imagePullSecretRefs?: string[];
  secretStoreRef?: string;
  publicVirtualHost?: string;
  organizationVirtualHost?: string;
  publicHTTPPort?: number;
  publicHTTPSPort?: number;
  organizationHTTPPort?: number;
  organizationHTTPSPort?: number;
  observabilityPlaneRef?: string;
  createdAt?: string;
  status?: string;
}

export interface DataPlaneWithEnvironments extends DataPlane {
  environments: Environment[];
}

export interface PlatformEnvironmentService {
  /**
   * Fetches all environments across all organizations
   */
  fetchAllEnvironments(userToken?: string): Promise<Environment[]>;

  /**
   * Fetches environments for a specific organization
   */
  fetchEnvironmentsByOrganization(
    organizationName: string,
    userToken?: string,
  ): Promise<Environment[]>;

  /**
   * Fetches all dataplanes across all organizations
   */
  fetchAllDataplanes(userToken?: string): Promise<DataPlane[]>;

  /**
   * Fetches dataplanes for a specific organization
   */
  fetchDataplanesByOrganization(
    organizationName: string,
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
      orgName: string;
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
      orgName: string;
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
      orgName: string;
      projectName: string;
      componentName: string;
    }>,
    userToken?: string,
  ): Promise<number>;
}
