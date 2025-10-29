import { DiscoveryApi, IdentityApi } from '@backstage/core-plugin-api';
import { CatalogApi } from '@backstage/catalog-client';
import { DataPlane, Environment } from '../types';

interface ComponentInfo {
  orgName: string;
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
  identity: IdentityApi,
  catalogApi: CatalogApi,
): Promise<PlatformOverviewData> {
  try {
    const { token } = await identity.getCredentials();
    const baseUrl = await discovery.getBaseUrl('platform-engineer-core');

    // Fetch dataplanes and environments in parallel
    const [dataplanesRes, environmentsRes] = await Promise.all([
      fetch(new URL(`${baseUrl}/dataplanes`), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
      fetch(new URL(`${baseUrl}/environments`), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
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
      const orgName =
        annotations['openchoreo.io/organization'] ||
        annotations['backstage.io/managed-by-location']?.split('/')[3] ||
        'default'; // fallback

      const projectName =
        annotations['openchoreo.io/project'] ||
        component.metadata.namespace ||
        'default'; // fallback

      const componentName = component.metadata.name;

      if (orgName && projectName && componentName) {
        componentInfos.push({
          orgName,
          projectName,
          componentName,
        });
      }
    });

    // Call the backend to get healthy workload count
    const healthyWorkloadUrl = new URL(
      `${baseUrl}/healthy-workload-count`,
    );

    const healthyWorkloadRes = await fetch(healthyWorkloadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        components: componentInfos,
      }),
    });

    let healthyWorkloadCount = 0;
    if (healthyWorkloadRes.ok) {
      const healthyWorkloadData = await healthyWorkloadRes.json();
      if (healthyWorkloadData.success) {
        healthyWorkloadCount = healthyWorkloadData.data;
      }
    } else {
      console.warn('Failed to fetch healthy workload count');
    }

    return {
      dataplanes,
      environments,
      healthyWorkloadCount,
    };
  } catch (error) {
    console.error('Error fetching platform overview:', error);
    throw error;
  }
}

