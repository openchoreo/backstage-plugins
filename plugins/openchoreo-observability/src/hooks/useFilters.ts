import { useCallback, useState } from 'react';
import { Environment, Filters } from '../types';

const DEFAULT_TIME_RANGE = '10m';
/**
 * Hook to manage metrics filters state
 * @returns filters state and methods to update filters
 */
export function useFilters() {
  const [filters, setFilters] = useState<Filters>({
    environment: null as unknown as Environment,
    timeRange: DEFAULT_TIME_RANGE,
    components: [],
    searchQuery: '',
  });

  const updateFilters = useCallback((newFilters: Partial<Filters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      environment: null as unknown as Environment,
      timeRange: DEFAULT_TIME_RANGE,
      components: [],
      searchQuery: '',
    });
  }, []);

  return { filters, updateFilters, resetFilters };
}
