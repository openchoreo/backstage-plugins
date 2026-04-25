import { useCallback, useRef, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { calculateTimeRange } from '../components/RuntimeLogs/utils';
import { Trigger } from '../components/Triggers/types';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

export interface UseTriggersOptions {
  environmentId: string;
  environmentName: string;
  timeRange: string;
  limit?: number;
  offset?: number;
  sortOrder?: 'asc' | 'desc';
}

export interface UseTriggersResult {
  triggers: Trigger[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  fetchTriggers: (reset?: boolean) => Promise<void>;
  refresh: () => void;
}

export function useTriggers(
  entity: Entity,
  namespace: string,
  project: string,
  options: UseTriggersOptions,
): UseTriggersResult {
  const observabilityApi = useApi(observabilityApiRef);
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const requestVersionRef = useRef(0);

  const componentName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];

  const fetchTriggers = useCallback(
    async (_reset = true) => {
      if (
        !options.environmentId ||
        !options.environmentName ||
        !namespace ||
        !project ||
        !componentName
      ) {
        return;
      }

      const version = ++requestVersionRef.current;

      try {
        setLoading(true);
        setError(null);

        const { startTime, endTime } = calculateTimeRange(options.timeRange);

        const response = await observabilityApi.getTriggers(
          namespace,
          project,
          options.environmentName,
          componentName,
          {
            limit: options.limit ?? 20,
            offset: options.offset ?? 0,
            startTime,
            endTime,
            sortOrder: options.sortOrder ?? 'desc',
          },
        );

        if (version !== requestVersionRef.current) return;

        setTriggers(response.triggers ?? []);
        setTotalCount(response.total ?? 0);
      } catch (err) {
        if (version !== requestVersionRef.current) return;
        setError(
          err instanceof Error ? err.message : 'Failed to fetch triggers',
        );
      } finally {
        if (version === requestVersionRef.current) {
          setLoading(false);
        }
      }
    },
    [
      observabilityApi,
      options.environmentId,
      options.environmentName,
      options.timeRange,
      options.limit,
      options.offset,
      options.sortOrder,
      namespace,
      project,
      componentName,
    ],
  );

  const refresh = useCallback(() => {
    setTriggers([]);
    fetchTriggers(true);
  }, [fetchTriggers]);

  return {
    triggers,
    loading,
    error,
    totalCount,
    fetchTriggers,
    refresh,
  };
}
