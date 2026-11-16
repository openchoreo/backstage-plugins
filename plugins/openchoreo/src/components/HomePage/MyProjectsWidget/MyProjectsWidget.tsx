import { useCallback, useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { SummaryWidgetWrapper } from '@openchoreo/backstage-plugin-react';
import FolderIcon from '@material-ui/icons/Folder';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';

interface MyProjectsWidgetProps {
  /** Render only the metrics body, letting an outer frame own the card and title. */
  disableCard?: boolean;
}

// One place for the metric labels, so the real widget and its preview match.
const buildMetrics = (
  projects: number,
  components: number,
  activeDeployments: number,
) => [
  { label: 'Projects:', value: projects },
  { label: 'Components:', value: components },
  { label: 'Active Deployments:', value: activeDeployments },
];

// Widget showing project/component/deployment metrics for developers.
export const MyProjectsWidget = ({
  disableCard = false,
}: MyProjectsWidgetProps = {}) => {
  const [componentsCount, setComponentsCount] = useState<number>(0);
  const [projectsCount, setProjectsCount] = useState<number>(0);
  const [componentBindingsCount, setComponentBindingsCount] =
    useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const catalogApi = useApi(catalogApiRef);
  const client = useApi(openChoreoClientApiRef);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch components and projects (systems) from catalog
      const [componentsResponse, systemsResponse] = await Promise.all([
        catalogApi.getEntities({
          filter: { kind: 'Component' },
        }),
        catalogApi.getEntities({
          filter: { kind: 'System' },
        }),
      ]);

      setComponentsCount(componentsResponse.items.length);
      setProjectsCount(systemsResponse.items.length);

      // Extract component info for fetching bindings
      const componentInfoList = componentsResponse.items
        .map(component => {
          const annotations = component.metadata.annotations || {};
          const namespaceName = annotations[CHOREO_ANNOTATIONS.NAMESPACE];
          const projectName = annotations[CHOREO_ANNOTATIONS.PROJECT];
          const componentName = annotations[CHOREO_ANNOTATIONS.COMPONENT];

          if (namespaceName && projectName && componentName) {
            return { namespaceName, projectName, componentName };
          }
          return null;
        })
        .filter(
          (
            info,
          ): info is {
            namespaceName: string;
            projectName: string;
            componentName: string;
          } => info !== null,
        );

      // Fetch total bindings count from backend
      if (componentInfoList.length > 0) {
        const totalBindings = await client.fetchTotalBindingsCount(
          componentInfoList,
        );
        setComponentBindingsCount(totalBindings);
      } else {
        setComponentBindingsCount(0);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch project data',
      );
      setComponentsCount(0);
      setProjectsCount(0);
      setComponentBindingsCount(0);
    } finally {
      setLoading(false);
    }
  }, [catalogApi, client]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <SummaryWidgetWrapper
      disableCard={disableCard}
      icon={<FolderIcon fontSize="inherit" />}
      title="My Projects"
      metrics={buildMetrics(
        projectsCount,
        componentsCount,
        componentBindingsCount,
      )}
      loading={loading}
      errorMessage={error || undefined}
    />
  );
};

// Static preview for the home page "Add widget" gallery. It shows sample numbers
// and never calls an API, so it is safe to render before the widget is added.
export const MyProjectsWidgetPreview = ({
  disableCard = false,
}: MyProjectsWidgetProps = {}) => (
  <SummaryWidgetWrapper
    disableCard={disableCard}
    icon={<FolderIcon fontSize="inherit" />}
    title="My Projects"
    metrics={buildMetrics(2, 6, 9)}
  />
);
