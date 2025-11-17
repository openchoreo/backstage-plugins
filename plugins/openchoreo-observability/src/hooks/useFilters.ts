import { useCallback, useState } from 'react';
import { Filters } from '../types';

/**
 * Hook to manage metrics filters state
 * @returns filters state and methods to update filters
 */
export function useFilters() {
  const [filters, setFilters] = useState<Filters>({
    environmentId: '',
    timeRange: '1h',
  });

  const updateFilters = useCallback((newFilters: Partial<Filters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      environmentId: '',
      timeRange: '1h',
    });
  }, []);

  return { filters, updateFilters, resetFilters };
}
