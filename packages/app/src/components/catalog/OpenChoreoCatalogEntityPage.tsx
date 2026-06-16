import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAsyncRetry from 'react-use/esm/useAsyncRetry';
import type { Entity } from '@backstage/catalog-model';
import { errorApiRef, useApi, useRouteRefParams } from '@backstage/core-plugin-api';
import {
  AsyncEntityProvider,
  catalogApiRef,
  entityRouteRef,
  type EntityLoadingStatus,
} from '@backstage/plugin-catalog-react';
import { OpenChoreoEntityLayout } from '@openchoreo/backstage-plugin-react';
import { EntityLayoutWithDelete } from './EntityLayoutWithDelete';

/**
 * Local copy of upstream's internal `useEntityFromUrl` hook (not part of
 * `@backstage/plugin-catalog`'s public surface — see
 * `node_modules/@backstage/plugin-catalog/src/components/CatalogEntityPage/useEntityFromUrl.ts`).
 * Inlined here so the NFS `page:catalog/entity` override can mount its own
 * `AsyncEntityProvider` without relying on a private import.
 */
function useEntityFromUrl(): EntityLoadingStatus {
  const { kind, namespace, name } = useRouteRefParams(entityRouteRef);
  const navigate = useNavigate();
  const errorApi = useApi(errorApiRef);
  const catalogApi = useApi(catalogApiRef);

  const {
    value: entity,
    error,
    loading,
    retry: refresh,
  } = useAsyncRetry(
    () =>
      catalogApi.getEntityByRef({ kind, namespace, name }) as Promise<
        Entity | undefined
      >,
    [catalogApi, kind, namespace, name],
  );

  useEffect(() => {
    if (!name) {
      errorApi.post(new Error('No name provided!'));
      navigate('/');
    }
  }, [errorApi, navigate, error, loading, entity, name]);

  return { entity, loading, error, refresh };
}

interface OpenChoreoCatalogEntityPageProps {
  /**
   * The route children to render inside the layout. The NFS
   * `page:catalog/entity` loader maps `inputs.contents` to
   * `<OpenChoreoEntityLayout.Route>` elements and passes them here.
   */
  children: ReactNode;
}

/**
 * Replacement for the host's legacy `<CatalogEntityPage>` mount, used by
 * the NFS `page:catalog/entity` extension override. Provides the
 * `AsyncEntityProvider` (which upstream's loader does for its own
 * `EntityLayout`) and delegates the layout to {@link EntityLayoutWithDelete}
 * so the OpenChoreo header, delete + edit-annotations menu items, and
 * existence-check empty states are preserved when the host migrates off
 * the legacy `FlatRoutes` entity mount.
 */
export function OpenChoreoCatalogEntityPage({
  children,
}: OpenChoreoCatalogEntityPageProps) {
  return (
    <AsyncEntityProvider {...useEntityFromUrl()}>
      <EntityLayoutWithDelete>{children}</EntityLayoutWithDelete>
    </AsyncEntityProvider>
  );
}

// Re-export so the override loader (which can't usefully import a JSX
// runtime component from a deep React module) has a single entry.
export { OpenChoreoEntityLayout };
