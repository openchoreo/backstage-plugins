import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { CatalogApi } from '@backstage/catalog-client';
import { DataPlaneWithEnvironments } from '../types';

interface ComponentInfo {
  namespaceName: string;
  projectName: string;
  componentName: string;
}

export async function fetchDataplanesWithEnvironmentsAndComponents(
  discovery: DiscoveryApi,
  fetchApi: FetchApi,
  catalogApi: CatalogApi,
): Promise<DataPlaneWithEnvironments[]> {
  // First, get the basic dataplanes with environments
  const dataplanesUrl = `${await discovery.getBaseUrl(
    'platform-engineer-core',
  )}/dataplanes-with-environments-and-components`;

  const dataplanesRes = await fetchApi.fetch(dataplanesUrl);

  if (!dataplanesRes.ok) {
    throw new Error(
      `Failed to fetch dataplanes with environments: ${dataplanesRes.statusText}`,
    );
  }

  const dataplanesData = await dataplanesRes.json();
  if (!dataplanesData.success) {
    throw new Error(`API error: ${dataplanesData.error || 'Unknown error'}`);
  }

  const dataplanesWithEnvironments: DataPlaneWithEnvironments[] =
    dataplanesData.data || [];

  // Now get component counts using the bindings API
  try {
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
      // These might be stored in different ways depending on your setup
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

    // Call the backend to get component counts per environment using bindings API
    const componentCountsUrl = `${await discovery.getBaseUrl(
      'platform-engineer-core',
    )}/component-counts-per-environment`;

    const componentCountsRes = await fetchApi.fetch(componentCountsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        components: componentInfos,
      }),
    });

    if (componentCountsRes.ok) {
      const countsData = await componentCountsRes.json();
      if (countsData.success) {
        const componentCountsByEnvironment: Record<string, number> =
          countsData.data;

        // Update the environments with component counts
        const enrichedDataplanes = dataplanesWithEnvironments.map(
          dataplane => ({
            ...dataplane,
            environments: dataplane.environments.map(env => ({
              ...env,
              componentCount: componentCountsByEnvironment[env.name] || 0,
            })),
          }),
        );

        return enrichedDataplanes;
      }
    }

    return dataplanesWithEnvironments;
  } catch (catalogError) {
    // Return the original data without component counts if catalog fails
    return dataplanesWithEnvironments;
  }
}
