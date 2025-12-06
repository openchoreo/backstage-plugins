import { useCallback, useState } from 'react';
import { Environment, Filters } from '../types';

/**
 * Hook to manage metrics filters state
 * @returns filters state and methods to update filters
 */
export function useFilters() {
  const [filters, setFilters] = useState<Filters>({
    environment: null as unknown as Environment,
    timeRange: '1h',
    componentIds: [],
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
      timeRange: '1h',
      componentIds: [],
      searchQuery: '',
    });
  }, []);

  return { filters, updateFilters, resetFilters };
}
