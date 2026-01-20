import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { CatalogApi } from '@backstage/catalog-client';

interface ComponentInfo {
  namespaceName: string;
  projectName: string;
  componentName: string;
}

export async function fetchDistinctDeployedComponentsCount(
  discovery: DiscoveryApi,
  fetchApi: FetchApi,
  catalogApi: CatalogApi,
): Promise<number> {
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

    // Call the backend to get distinct deployed components count
    const distinctCountUrl = `${await discovery.getBaseUrl(
      'platform-engineer-core',
    )}/distinct-deployed-components-count`;

    const distinctCountRes = await fetchApi.fetch(distinctCountUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        components: componentInfos,
      }),
    });

    if (distinctCountRes.ok) {
      const countData = await distinctCountRes.json();
      if (countData.success) {
        return countData.data;
      }
    }

    return 0;
  } catch (error) {
    return 0;
  }
}
