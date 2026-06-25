import { Entity } from '@backstage/catalog-model';
import { useGetNamespaceAndProjectByEntity } from './useGetNamespaceAndProjectByEntity';
import { useWirelogsEnvironments } from './useWirelogsEnvironments';

/**
 * Resolves Cilium CNI availability for a component entity on the client:
 * derives the project + namespace from the entity's annotations,
 * fetches the project's environments and probes each backing
 * DataPlane's `networkpolicyprovider` via the observability backend.
 *
 * Returns `true` once at least one environment runs Cilium. While the probe is
 * in flight `environments` is empty, so the result is `false` until it resolves.
 */
export const useComponentHasAnyCiliumEnabledEnvironment = (
  entity: Entity,
): boolean => {
  const { namespace, project } = useGetNamespaceAndProjectByEntity(entity);
  const { environments } = useWirelogsEnvironments(project, namespace);
  return environments.some(env => env.hasWirelogs);
};
