import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
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

  // Stale-while-revalidate: keep the previously resolved entity visible while
  // the next one loads. `useAsyncRetry` resets `value` to undefined on every
  // param change, which would make the descendant `EntitySwitch` render
  // nothing (it drops all cases when `loading && !entity`) — unmounting the
  // entire page, header included, on each cross-entity navigation. Retaining
  // the previous entity keeps the layout/header mounted; the header still
  // derives the *current* entity's identity from the URL params, so stale
  // values never surface for the entity you navigated to.
  const lastEntityRef = useRef<Entity | undefined>(undefined);
  useEffect(() => {
    if (!loading) {
      lastEntityRef.current = entity;
    }
  }, [loading, entity]);
  const stableEntity = loading ? entity ?? lastEntityRef.current : entity;

  useEffect(() => {
    if (!name) {
      errorApi.post(new Error('No name provided!'));
      navigate('/');
    }
  }, [errorApi, navigate, error, loading, entity, name]);

  return { entity: stableEntity, loading, error, refresh };
}

interface OpenChoreoCatalogEntityPageProps {
  /**
   * The legacy `entityPage` `<EntitySwitch>`. Each per-kind branch
   * (`componentPage`, `dataplanePage`, etc.) already opens with its own
   * `<EntityLayoutWithDelete>` + `<OpenChoreoEntityLayout.Route>` children,
   * so we only need to provide the `AsyncEntityProvider` here — wrapping
   * the switch in another `EntityLayoutWithDelete` would double-wrap and
   * fail `OpenChoreoEntityLayout`'s strict Route-child check.
   */
  children: ReactNode;
}

/**
 * Replacement for the legacy `<CatalogEntityPage>` mount, used by the NFS
 * `page:catalog/entity` extension override in `customOverrides.tsx`. Owns
 * the `AsyncEntityProvider` so descendant `useAsyncEntity()` /
 * `useEntity()` calls in the per-kind layouts work; layout/header/tab
 * styling lives inside each per-kind page's own `EntityLayoutWithDelete` →
 * `OpenChoreoEntityLayout`.
 */
export function OpenChoreoCatalogEntityPage({
  children,
}: OpenChoreoCatalogEntityPageProps) {
  return (
    <AsyncEntityProvider {...useEntityFromUrl()}>
      {children}
    </AsyncEntityProvider>
  );
}
