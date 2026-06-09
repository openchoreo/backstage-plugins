import type { ComponentEventEntry } from '@openchoreo/backstage-plugin-common';

/**
 * A single Kubernetes event entry as returned by POST /api/v1/events/query.
 * Fields come from the EventEntry schema in the observability API.
 */
export type EventEntry = ComponentEventEntry;

export interface EventsResponse {
  events: EventEntry[];
  /** Total number of matching events */
  total?: number;
  tookMs?: number;
}

export interface RuntimeEventsFilters {
  selectedFields: EventEntryField[];
  environment: string;
  timeRange: string;
  /** ISO start time, used when `timeRange === 'custom'` */
  customStartTime?: string;
  /** ISO end time, used when `timeRange === 'custom'` */
  customEndTime?: string;
  sortOrder?: 'asc' | 'desc';
  isLive?: boolean;
}

export enum EventEntryField {
  Timestamp = 'Timestamp',
  Type = 'Type',
  Reason = 'Reason',
  Object = 'Object',
  Message = 'Message',
}

export const SELECTED_FIELDS = [
  EventEntryField.Timestamp,
  EventEntryField.Type,
  EventEntryField.Reason,
  EventEntryField.Object,
  EventEntryField.Message,
];
