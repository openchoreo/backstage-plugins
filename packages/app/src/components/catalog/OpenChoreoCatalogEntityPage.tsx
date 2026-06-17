import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAsyncRetry from 'react-use/esm/useAsyncRetry';
import type { Entity } from '@backstage/catalog-model';
import {
  errorApiRef,
  useApi,
  useRouteRefParams,
} from '@backstage/core-plugin-api';
import {
  AsyncEntityProvider,
  catalogApiRef,
  entityRouteRef,
  type EntityLoadingStatus,
} from '@backstage/plugin-catalog-react';
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
   * Layout children — the legacy `entityPage` `<EntitySwitch>` plus any
   * dynamic NFS-contributed `<OpenChoreoEntityLayout.Route>` entries from
   * `inputs.contents`.
   */
  children: ReactNode;
}

/**
 * Replacement for the legacy `<CatalogEntityPage>` mount, used by the NFS
 * `page:catalog/entity` extension override in `customOverrides.tsx`. Owns
 * the `AsyncEntityProvider` (so descendant `useEntity()` calls work) and
 * delegates layout to `EntityLayoutWithDelete`, which wraps
 * `OpenChoreoEntityLayout` with the OpenChoreo header, delete +
 * edit-annotations menu items, and existence-check empty states.
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
