import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { CatalogApi } from '@backstage/catalog-client';
import { DataPlane, Environment } from '../types';

interface ComponentInfo {
  namespaceName: string;
  projectName: string;
  componentName: string;
}

export interface PlatformOverviewData {
  dataplanes: DataPlane[];
  environments: Environment[];
  healthyWorkloadCount: number;
}

/**
 * Fetches platform overview data including dataplanes, environments, and healthy workload count
 */
export async function fetchPlatformOverview(
  discovery: DiscoveryApi,
  fetchApi: FetchApi,
  catalogApi: CatalogApi,
): Promise<PlatformOverviewData> {
  try {
    const baseUrl = await discovery.getBaseUrl('platform-engineer-core');

    // Fetch dataplanes and environments in parallel
    const [dataplanesRes, environmentsRes] = await Promise.all([
      fetchApi.fetch(`${baseUrl}/dataplanes`),
      fetchApi.fetch(`${baseUrl}/environments`),
    ]);

    if (!dataplanesRes.ok || !environmentsRes.ok) {
      throw new Error(
        `Failed to fetch platform data: dataplanes=${dataplanesRes.status}, environments=${environmentsRes.status}`,
      );
    }

    const [dataplanesData, environmentsData] = await Promise.all([
      dataplanesRes.json(),
      environmentsRes.json(),
    ]);

    if (!dataplanesData.success || !environmentsData.success) {
      throw new Error('API error fetching platform data');
    }

    const dataplanes: DataPlane[] = dataplanesData.data || [];
    const environments: Environment[] = environmentsData.data || [];

    // Fetch all components from the catalog
    const components = await catalogApi.getEntities({
      filter: {
        kind: 'Component',
      },
    });

    // Extract component information needed for bindings API
    const componentInfos: ComponentInfo[] = [];

    components.items.forEach(component => {
      const annotations = component.metadata.annotations || {};

      // Extract org, project, and component name from annotations or metadata
      const namespaceName =
        annotations['openchoreo.io/namespace'] ||
        annotations['backstage.io/managed-by-location']?.split('/')[3] ||
        'default'; // fallback

      const projectName =
        annotations['openchoreo.io/project'] ||
        component.metadata.namespace ||
        'default'; // fallback

      const componentName = component.metadata.name;

      if (namespaceName && projectName && componentName) {
        componentInfos.push({
          namespaceName,
          projectName,
          componentName,
        });
      }
    });

    // Call the backend to get healthy workload count
    const healthyWorkloadRes = await fetchApi.fetch(
      `${baseUrl}/healthy-workload-count`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          components: componentInfos,
        }),
      },
    );

    let healthyWorkloadCount = 0;
    if (healthyWorkloadRes.ok) {
      const healthyWorkloadData = await healthyWorkloadRes.json();
      if (healthyWorkloadData.success) {
        healthyWorkloadCount = healthyWorkloadData.data;
      }
    }

    return {
      dataplanes,
      environments,
      healthyWorkloadCount,
    };
  } catch (error) {
    throw error;
  }
}
