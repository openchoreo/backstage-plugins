import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  RuntimeEventsFilters,
  EventEntryField,
  SELECTED_FIELDS,
} from '../components/RuntimeEvents/types';
import { Environment } from '@openchoreo/backstage-plugin-react';
import { useAutoSelectFirstEnvironment } from './useAutoSelectFirstEnvironment';
import { parseUrlTimeRange, writeUrlTimeRange } from '../utils/urlTimeRange';

interface UseUrlFiltersForRuntimeEventsOptions {
  /** Available environments to map envName from URL */
  environments: Environment[];
}

/**
 * Hook for managing runtime events filters synced to URL query parameters.
 *
 * Query parameters:
 * - `env`: Environment name (auto-selected if not present or invalid)
 * - `timeRange`: Time range value (defaults to '10m')
 * - `sort`: Sort order ('asc' or 'desc')
 * - `live`: 'true' for live polling
 * - `fields`: Comma-separated EventEntryField values
 */
export function useUrlFiltersForRuntimeEvents({
  environments,
}: UseUrlFiltersForRuntimeEventsOptions) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse filters from URL
  const filters = useMemo<RuntimeEventsFilters>(() => {
    const envName = searchParams.get('env');
    const { timeRange, customStartTime, customEndTime } =
      parseUrlTimeRange(searchParams);

    const rawSortOrder = searchParams.get('sort');
    const sortOrder: 'asc' | 'desc' =
      rawSortOrder === 'asc' || rawSortOrder === 'desc' ? rawSortOrder : 'asc';

    const isLive = searchParams.get('live') === 'true';

    // Parse selectedFields from URL
    const fieldsParam = searchParams.get('fields');
    let selectedFields: EventEntryField[];
    if (fieldsParam) {
      selectedFields = fieldsParam
        .split(',')
        .filter(f =>
          Object.values(EventEntryField).includes(f as EventEntryField),
        )
        .map(f => f as EventEntryField);
      // Ensure Message field is always included
      if (!selectedFields.includes(EventEntryField.Message)) {
        selectedFields.push(EventEntryField.Message);
      }
      // Normalize to the canonical column order
      selectedFields = SELECTED_FIELDS.filter(field =>
        selectedFields.includes(field),
      );
    } else {
      // Default to all fields
      selectedFields = [...SELECTED_FIELDS];
    }

    const environment = envName
      ? environments.find(e => e.name === envName)
      : undefined;

    return {
      environment: environment?.name || '',
      timeRange,
      customStartTime,
      customEndTime,
      selectedFields,
      sortOrder,
      isLive: isLive || false,
    };
  }, [searchParams, environments]);

  // Auto-select first environment if none selected or URL has a stale env id
  useAutoSelectFirstEnvironment(environments, searchParams, setSearchParams);

  // Update URL when filters change
  const updateFilters = useCallback(
    (newFilters: Partial<RuntimeEventsFilters>) => {
      const newParams = new URLSearchParams(searchParams);

      if (newFilters.environment !== undefined) {
        if (newFilters.environment) {
          newParams.set('env', newFilters.environment);
        } else {
          newParams.delete('env');
        }
      }

      writeUrlTimeRange(newParams, newFilters);

      if (newFilters.selectedFields !== undefined) {
        // Ensure Message field is always included
        let fields = newFilters.selectedFields;
        if (!fields.includes(EventEntryField.Message)) {
          fields = [...fields, EventEntryField.Message];
        }

        // Normalize order to match SELECTED_FIELDS
        const normalizedFields = SELECTED_FIELDS.filter(field =>
          fields.includes(field),
        );

        // Only store in URL if not the default (all fields selected)
        const isDefaultFields =
          normalizedFields.length === SELECTED_FIELDS.length &&
          normalizedFields.every(
            (field, index) => field === SELECTED_FIELDS[index],
          );

        if (isDefaultFields) {
          newParams.delete('fields');
        } else {
          newParams.set('fields', normalizedFields.join(','));
        }
      }

      if (newFilters.sortOrder !== undefined) {
        if (newFilters.sortOrder === 'asc') {
          // Default value - remove from URL
          newParams.delete('sort');
        } else {
          newParams.set('sort', newFilters.sortOrder);
        }
      }

      if (newFilters.isLive !== undefined) {
        if (newFilters.isLive) {
          newParams.set('live', 'true');
        } else {
          newParams.delete('live');
        }
      }

      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // Reset filters to defaults
  const resetFilters = useCallback(() => {
    const newParams = new URLSearchParams();
    if (environments.length > 0) {
      newParams.set('env', environments[0].name);
    }
    setSearchParams(newParams, { replace: true });
  }, [environments, setSearchParams]);

  return { filters, updateFilters, resetFilters };
}
