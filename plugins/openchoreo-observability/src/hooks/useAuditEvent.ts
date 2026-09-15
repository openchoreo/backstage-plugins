import { useApi } from '@backstage/core-plugin-api';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { AuditLogRecord } from '../components/AuditLogs/types';
import { AuditWindow, buildAuditQuery } from '../components/AuditLogs/query';

export interface UseAuditEventOptions {
  window: AuditWindow;
  eventId?: string;
  enabled?: boolean;
}

export interface UseAuditEventResult {
  record?: AuditLogRecord;
  loading: boolean;
  error: Error | null;
}

/**
 * Reads one record by `event_id`, for a link naming an event that is on none of
 * the pages the reader has loaded.
 *
 * Bounded by the window around it, because `startTime` and `endTime` are
 * required — so an event that has fallen out of a relative range stays
 * unreachable and the caller shows the list rather than the drawer.
 */
export function useAuditEvent(
  options: UseAuditEventOptions,
): UseAuditEventResult {
  const observabilityApi = useApi(observabilityApiRef);
  const { window: auditWindow, eventId, enabled = true } = options;

  const { data, loading, error } = useOpenChoreoQuery(
    [
      'audit-log-event',
      eventId ?? '',
      auditWindow.startTime,
      auditWindow.endTime,
    ],
    () =>
      observabilityApi.queryAuditLogs(
        buildAuditQuery({
          window: auditWindow,
          tokens: [{ path: 'event_id', value: eventId as string }],
          limit: 1,
        }),
      ),
    {
      enabled: enabled && Boolean(eventId),
      // The trail is append-only, so a record cannot change once written.
      staleTime: 5 * 60_000,
    },
  );

  return { record: data?.records?.[0], loading, error };
}
