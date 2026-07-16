import { useCallback, useRef, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { Retry } from '../components/Runs/types';

export interface UseRetriesOptions {
  jobName: string;
  namespaceName: string;
  projectName: string;
  environmentName: string;
  componentName: string;
  /**
   * Optional. Scope the events fetch to a specific run's lifetime. Must be
   * paired with `endTime` — the backend rejects one-only (both-or-none). Set
   * these when the caller knows the run window so the observer adapter does
   * not silently truncate at its 1000-event-per-call cap on high-frequency
   * CronJobs. When omitted, the backend falls back to a 30-day lookback.
   */
  startTime?: string;
  /**
   * Optional. See `startTime` — both must be provided together.
   */
  endTime?: string;
}

export interface UseRetriesResult {
  retries: Retry[];
  loading: boolean;
  error: string | null;
  fetchRetries: () => Promise<void>;
}

export function useRetries(options: UseRetriesOptions): UseRetriesResult {
  const observabilityApi = useApi(observabilityApiRef);
  const [retries, setRetries] = useState<Retry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersionRef = useRef(0);

  const fetchRetries = useCallback(async () => {
    if (
      !options.jobName ||
      !options.namespaceName ||
      !options.environmentName ||
      !options.componentName
    ) {
      return;
    }

    const version = ++requestVersionRef.current;

    try {
      setLoading(true);
      setError(null);

      const response = await observabilityApi.getRetries(
        options.jobName,
        options.namespaceName,
        options.projectName,
        options.environmentName,
        options.componentName,
        options.startTime && options.endTime
          ? { startTime: options.startTime, endTime: options.endTime }
          : undefined,
      );

      if (version !== requestVersionRef.current) return;

      setRetries(response.retries ?? []);
    } catch (err) {
      if (version !== requestVersionRef.current) return;
      setError(
        err instanceof Error ? err.message : 'Failed to fetch retries',
      );
    } finally {
      if (version === requestVersionRef.current) {
        setLoading(false);
      }
    }
  }, [
    observabilityApi,
    options.jobName,
    options.namespaceName,
    options.projectName,
    options.environmentName,
    options.componentName,
    options.startTime,
    options.endTime,
  ]);

  return {
    retries,
    loading,
    error,
    fetchRetries,
  };
}
