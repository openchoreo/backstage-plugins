import { useState, useCallback, useRef, useEffect } from 'react';

export type NotificationType = 'success' | 'error';

export interface Notification {
  message: string;
  type: NotificationType;
}

export interface UseNotificationOptions {
  /** Auto-hide delay for success notifications in milliseconds (default: 5000) */
  successAutoHideMs?: number;
  /** Auto-hide delay for error notifications in milliseconds (default: 7000) */
  errorAutoHideMs?: number;
}

/**
 * Hook for managing temporary notifications with auto-hide functionality.
 * Properly cleans up timeouts on unmount to prevent memory leaks.
 *
 * @example
 * const notification = useNotification();
 *
 * // Show notifications
 * notification.showSuccess('Operation completed!');
 * notification.showError('Something went wrong');
 *
 * // In JSX
 * {notification.notification && (
 *   <NotificationBanner
 *     message={notification.notification.message}
 *     type={notification.notification.type}
 *   />
 * )}
 */
export function useNotification(options: UseNotificationOptions = {}) {
  const { successAutoHideMs = 5000, errorAutoHideMs = 7000 } = options;

  const [notification, setNotification] = useState<Notification | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const clearExistingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  }, []);

  const show = useCallback(
    (message: string, type: NotificationType) => {
      clearExistingTimeout();
      setNotification({ message, type });

      const autoHideMs =
        type === 'success' ? successAutoHideMs : errorAutoHideMs;
      timeoutRef.current = setTimeout(() => {
        setNotification(null);
      }, autoHideMs);
    },
    [clearExistingTimeout, successAutoHideMs, errorAutoHideMs],
  );

  const showSuccess = useCallback(
    (message: string) => show(message, 'success'),
    [show],
  );

  const showError = useCallback(
    (message: string) => show(message, 'error'),
    [show],
  );

  const hide = useCallback(() => {
    clearExistingTimeout();
    setNotification(null);
  }, [clearExistingTimeout]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    /** Current notification or null if none */
    notification,
    /** Show a success notification */
    showSuccess,
    /** Show an error notification */
    showError,
    /** Manually hide the current notification */
    hide,
  };
}
