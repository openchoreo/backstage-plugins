import { useApi } from '@backstage/core-plugin-api';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import type { ActionInfo } from '../../../api/OpenChoreoClientApi';

interface UseActionsResult {
  actions: ActionInfo[];
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
  error: Error | null;
  fetchActions: () => Promise<void>;
}

export function useActions(): UseActionsResult {
  const client = useApi(openChoreoClientApiRef);

  const { data, loading, isRefetching, error, refetch } = useOpenChoreoQuery(
    ['actions'],
    () => client.listActions(),
  );

  return {
    actions: data ?? [],
    loading,
    isRefetching,
    error,
    fetchActions: async () => {
      await refetch();
    },
  };
}
