import { useApi } from '@backstage/core-plugin-api';
import { stringifyEntityRef, type Entity } from '@backstage/catalog-model';
import type {
  ReleaseLineOverrides,
  ReleaseLineSummary,
} from '@openchoreo/backstage-plugin-common';
import {
  useOpenChoreoMutation,
  useOpenChoreoQuery,
} from '@openchoreo/backstage-plugin-react';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';

/** Query key of a component's release lines. */
export const releaseLinesQueryKey = (entity: Entity) => [
  'release-line-summaries',
  stringifyEntityRef(entity),
];

/**
 * The lines of a component, main first, with a mutation that creates a
 * release line.
 */
export function useReleaseLines(
  entity: Entity,
  options: { enabled?: boolean } = {},
) {
  const client = useApi(openChoreoClientApiRef);
  const queryKey = releaseLinesQueryKey(entity);

  const { data, loading, isRefetching, error, refetch } = useOpenChoreoQuery<
    ReleaseLineSummary[]
  >(queryKey, () => client.fetchReleaseLines(entity), {
    enabled: options.enabled ?? true,
  });

  const { mutate: createReleaseLine, isLoading: creating } =
    useOpenChoreoMutation(
      (name: string, overrides?: ReleaseLineOverrides, description?: string) =>
        client.createReleaseLine(entity, name, overrides, description),
      { invalidates: [queryKey] },
    );

  return {
    releaseLines: data ?? [],
    loading,
    isRefetching,
    error,
    refetch,
    createReleaseLine,
    creating,
  };
}
