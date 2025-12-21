/**
 * Reusable hooks for state management patterns.
 *
 * These hooks consolidate common React state patterns to reduce boilerplate
 * and ensure proper cleanup (e.g., notification timeouts).
 */

export { useDialogWithSelection } from './useDialogWithSelection';
export { useItemActionTracker } from './useItemActionTracker';
export {
  useNotification,
  type Notification,
  type NotificationType,
  type UseNotificationOptions,
} from './useNotification';
export {
  useAsyncOperation,
  type AsyncStatus,
  type AsyncState,
} from '@openchoreo/backstage-plugin-react';
export { useQueryParams } from './useQueryParams';
