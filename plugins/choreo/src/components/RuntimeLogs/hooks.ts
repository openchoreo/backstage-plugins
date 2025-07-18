import { useCallback, useEffect, useRef, useState } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { discoveryApiRef, identityApiRef } from '@backstage/core-plugin-api';
import { useApi } from '@backstage/core-plugin-api';
import {
  getRuntimeLogs,
  getEnvironments,
  calculateTimeRange,
} from '../../api/runtime-logs';
import {
  LogEntry,
  Environment,
  RuntimeLogsFilters,
  RuntimeLogsPagination,
  LOG_LEVELS,
} from './types';

export function useEnvironments() {
  const { entity } = useEntity();
  const discovery = useApi(discoveryApiRef);
  const identity = useApi(identityApiRef);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEnvironments = async () => {
      try {
        setLoading(true);
        setError(null);
        const envs = await getEnvironments(entity, discovery, identity);
        setEnvironments(envs);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch environments',
        );
      } finally {
        setLoading(false);
      }
    };

    fetchEnvironments();
  }, [entity, discovery, identity]);

  return { environments, loading, error };
}

export function useRuntimeLogs(
  filters: RuntimeLogsFilters,
  pagination: RuntimeLogsPagination,
) {
  const { entity } = useEntity();
  const discovery = useApi(discoveryApiRef);
  const identity = useApi(identityApiRef);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchLogs = useCallback(
    async (reset: boolean = false) => {
      console.log('🚀 fetchLogs called', {
        reset,
        loading,
        environmentId: filters.environmentId,
        currentOffset: pagination.offset,
        filters,
        pagination,
      });

      if (loading || !filters.environmentId) {
        console.log('⚠️ fetchLogs early return', {
          loading,
          environmentId: filters.environmentId,
        });
        return;
      }

      try {
        console.log('⚙️ Setting loading to true');
        setLoading(true);
        setError(null);

        const { startTime, endTime } = calculateTimeRange(filters.timeRange);
        const currentOffset = reset ? 0 : pagination.offset;

        console.log('📞 Making API call with params:', {
          namespace: filters.environmentId,
          environmentId: filters.environmentId,
          logLevels: filters.logLevel,
          startTime,
          endTime,
          limit: pagination.limit,
          offset: currentOffset,
        });

        const response = await getRuntimeLogs(entity, discovery, identity, {
          environmentId: filters.environmentId,
          logLevels: filters.logLevel,
          startTime,
          endTime,
          limit: pagination.limit,
          offset: currentOffset,
        });

        console.log('✅ API response received:', {
          logsCount: response.logs.length,
          totalCount: response.totalCount,
          reset,
        });

        if (reset) {
          setLogs(response.logs);
        } else {
          setLogs(prev => [...prev, ...response.logs]);
        }

        setTotalCount(response.totalCount);
        setHasMore(response.logs.length === pagination.limit);
      } catch (err) {
        console.error('❌ fetchLogs error:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch logs');
      } finally {
        console.log('⚙️ Setting loading to false');
        setLoading(false);
      }
    },
    [entity, discovery, identity, filters, pagination, loading],
  );

  const loadMore = useCallback(() => {
    console.log('📜 loadMore called', { loading, hasMore });
    if (!loading && hasMore) {
      console.log('✅ Loading more logs');
      fetchLogs(false);
    }
  }, [fetchLogs, hasMore]);

  const refresh = useCallback(() => {
    console.log('🔄 Refresh called - clearing logs and fetching');
    setLogs([]);
    fetchLogs(true);
  }, [fetchLogs]);

  return {
    logs,
    loading,
    error,
    totalCount,
    hasMore,
    fetchLogs,
    loadMore,
    refresh,
  };
}

export function useInfiniteScroll(
  callback: () => void,
  hasMore: boolean,
  loading: boolean,
) {
  const [isFetching, setIsFetching] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    console.log('🔍 useInfiniteScroll setup effect', {
      loading,
      hasMore,
      isFetching,
    });
    if (loading || !hasMore) {
      console.log('⚠️ useInfiniteScroll early return', { loading, hasMore });
      return;
    }

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      entries => {
        console.log('👁️ Intersection observed', {
          isIntersecting: entries[0].isIntersecting,
          isFetching,
        });
        if (entries[0].isIntersecting && !isFetching) {
          console.log('✅ Triggering infinite scroll callback');
          setIsFetching(true);
          callback();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '200px',
      },
    );

    if (loadingRef.current) {
      observerRef.current.observe(loadingRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [callback, hasMore, loading, isFetching]);

  useEffect(() => {
    if (!loading) {
      console.log('⚙️ Resetting isFetching flag');
      setIsFetching(false);
    }
  }, [loading]);

  return { loadingRef };
}

export function useFilters() {
  const [filters, setFilters] = useState<RuntimeLogsFilters>({
    logLevel: LOG_LEVELS,
    environmentId: '',
    timeRange: '1h',
  });

  const updateFilters = useCallback(
    (newFilters: Partial<RuntimeLogsFilters>) => {
      console.log('🔍 updateFilters called', {
        newFilters,
        currentFilters: filters,
      });
      setFilters(prev => ({ ...prev, ...newFilters }));
    },
    [],
  );

  const resetFilters = useCallback(() => {
    setFilters({
      logLevel: LOG_LEVELS,
      environmentId: '',
      timeRange: '1h',
    });
  }, []);

  return { filters, updateFilters, resetFilters };
}
