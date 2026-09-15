import { useApi } from '@backstage/core-plugin-api';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { AuditFilterValuesNotSupportedError } from '../api/AuditLogsErrors';
import {
  AuditLogFilterValue,
  AuditPickableFilter,
  AuditQueryToken,
} from '../components/AuditLogs/types';
import { AuditWindow, buildAuditQuery } from '../components/AuditLogs/query';

/** Values a picker shows at once. Typing narrows the list server-side. */
export const AUDIT_MAX_PICKER_VALUES = 100;

export interface UseAuditFilterValuesOptions {
  window: AuditWindow;
  tokens: AuditQueryToken[];
  filter: AuditPickableFilter;
  /** Matches values containing this text, case-insensitively. */
  valueSearch?: string;
  maxValues?: number;
  /** Pass false while the picker is closed — this is the whole point of the hook. */
  enabled?: boolean;
}

export interface UseAuditFilterValuesResult {
  values: AuditLogFilterValue[];
  /**
   * The filter these values belong to, echoed by the observer. A caller must
   * compare it against the filter it currently wants before showing `values`:
   * the cache is shared with every other picker on the page, and
   * `keepPreviousData` holds the last filter's list across a switch, so values
   * for the wrong field would otherwise be rendered as this field's.
   */
  resolvedFilter?: string;
  /** Distinct values matching, of which at most `maxValues` were returned. */
  totalValues: number;
  loading: boolean;
  error: Error | null;
  /**
   * The adapter serves records but not this aggregation. A picker treats it as
   * "no pick list available" and accepts a typed value, never as "this filter
   * has no values".
   */
  unsupported: boolean;
}

/**
 * Lists the values one filter can take under the current query — what a picker
 * offers, with a count beside each value.
 *
 * One filter per request because answering every filter at once costs one
 * aggregation each; asking only for the picker that is open keeps the cost
 * proportional to what is on screen. The query is passed through untouched:
 * the endpoint honours its other filters and ignores the named filter's own
 * selections, so the list stays a way to change the selection rather than a
 * mirror of it.
 */
export function useAuditFilterValues(
  options: UseAuditFilterValuesOptions,
): UseAuditFilterValuesResult {
  const observabilityApi = useApi(observabilityApiRef);
  const {
    window: auditWindow,
    tokens,
    filter,
    valueSearch,
    maxValues = AUDIT_MAX_PICKER_VALUES,
    enabled = true,
  } = options;

  const { data, loading, error } = useOpenChoreoQuery(
    [
      'audit-log-filter-values',
      filter,
      auditWindow.startTime,
      auditWindow.endTime,
      JSON.stringify(tokens),
      valueSearch ?? '',
      maxValues,
    ],
    () =>
      observabilityApi.queryAuditLogFilterValues({
        // limit, sortOrder, cursor and the timeline flags carry no meaning
        // here and are accepted and ignored, so the query goes through as-is.
        query: buildAuditQuery({ window: auditWindow, tokens }),
        filter,
        ...(valueSearch ? { valueSearch } : {}),
        maxValues,
      }),
    {
      enabled,
      // Values shift only as the trail grows; a picker re-opened moments later
      // should not pay for the aggregation again.
      staleTime: 60_000,
      keepPreviousData: true,
      // The aggregation is expensive enough that a retry storm on a struggling
      // backend costs more than the picker is worth.
      retry: false,
    },
  );

  return {
    values: data?.values ?? [],
    resolvedFilter: data?.filter,
    totalValues: data?.totalValues ?? 0,
    loading,
    error,
    unsupported: error instanceof AuditFilterValuesNotSupportedError,
  };
}
