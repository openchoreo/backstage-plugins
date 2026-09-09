import { lazy, memo, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Box from '@material-ui/core/Box';
import { catalogApiRef, useEntity } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { useNavigate } from 'react-router-dom';
import { Organization } from '@openchoreo/cell-diagram';
import {
  useChoreoTokens,
  PageLoader,
} from '@openchoreo/backstage-design-system';
import { EmptyState } from '@openchoreo/backstage-plugin-react';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import { useNamespaceCellDiagramStyles } from './styles';

const CellView = lazy(() =>
  import('@openchoreo/cell-diagram').then(module => ({
    default: module.CellDiagram,
  })),
);

// The cell-diagram lib re-fits the canvas whenever its props object changes.
// Memoize on the values that actually affect rendering so parent re-renders
// (e.g. a fetch state flip) don't trigger a zoom/center race.
const MemoCellView = memo(
  CellView,
  (prev, next) =>
    prev.organization === next.organization && prev.mode === next.mode,
);

export const NamespaceCellDiagram = () => {
  const { entity } = useEntity();
  const client = useApi(openChoreoClientApiRef);
  const catalogApi = useApi(catalogApiRef);
  const navigate = useNavigate();
  const { mode } = useChoreoTokens();
  const classes = useNamespaceCellDiagramStyles();

  const [organization, setOrganization] = useState<Organization>();
  const [loading, setLoading] = useState(false);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const namespaceName = entity.metadata.name;

  // Keep navigation dependencies out of the click callback's identity so the
  // memoized diagram doesn't re-render when they change.
  const navDeps = useRef({ catalogApi, navigate, entity });
  navDeps.current = { catalogApi, navigate, entity };

  // Resolve a project (System entity) in this namespace and open its own
  // cell-diagram tab. No-op when the project isn't in the catalog.
  const navigateToProject = useCallback(async (projectId: string) => {
    if (!projectId) return;
    const { catalogApi: api, navigate: nav, entity: domain } = navDeps.current;
    try {
      const { items } = await api.getEntities({
        filter: {
          kind: 'System',
          'metadata.name': projectId,
          'relations.partof': stringifyEntityRef(domain),
        },
        fields: ['kind', 'metadata.name', 'metadata.namespace'],
      });
      const target = items[0];
      if (!target) return;
      const ns = target.metadata.namespace ?? 'default';
      nav(`/catalog/${ns}/system/${target.metadata.name}/cell-diagram`);
    } catch {
      // Swallow — a failed lookup just leaves the user on the namespace diagram.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await client.getNamespaceCellDiagramInfo(namespaceName);
        if (!cancelled) setOrganization(data as Organization);
      } catch {
        // swallow — empty/error state with Retry surfaces failure in the UI
      } finally {
        if (!cancelled) {
          setLoading(false);
          setHasFetchedOnce(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, namespaceName, refreshNonce]);

  const hasNoProjects =
    !!organization && (organization.projects?.length ?? 0) === 0;

  return (
    <Box className={classes.root}>
      {organization && !hasNoProjects && (
        <Suspense fallback={<PageLoader />}>
          <MemoCellView
            organization={organization}
            mode={mode}
            onComponentDoubleClick={navigateToProject}
          />
        </Suspense>
      )}

      {hasNoProjects && (
        <Box className={classes.centered} data-testid="namespace-cell-diagram-empty">
          <EmptyState
            title="No projects yet"
            description="This namespace does not have any projects. Create one to see it on the cell diagram."
          />
        </Box>
      )}

      {!organization && (loading || !hasFetchedOnce) && <PageLoader />}

      {!organization && hasFetchedOnce && !loading && (
        <Box className={classes.centered}>
          <EmptyState
            title="Failed to load cell diagram"
            description="Could not load namespace information. Try again in a moment."
            action={{
              label: 'Retry',
              onClick: () => setRefreshNonce(n => n + 1),
            }}
          />
        </Box>
      )}
    </Box>
  );
};
