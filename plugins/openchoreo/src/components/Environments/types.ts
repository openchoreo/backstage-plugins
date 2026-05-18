import type { PendingAction } from '@openchoreo/backstage-plugin-react';
import { useItemActionTracker } from '../../hooks';
import { Notification } from '../../hooks/useNotification';
import type { Environment } from './hooks/useEnvironmentData';

// Re-export Environment type from the data hook
export type {
  Environment,
  EndpointInfo,
  EndpointURLDetails,
} from './hooks/useEnvironmentData';
export type { Environment as EnvironmentType } from './hooks/useEnvironmentData';

// Re-export pending action types from shared library
export type {
  PendingDeployAction,
  PendingPromoteAction,
  PendingAction,
} from '@openchoreo/backstage-plugin-react';

/**
 * View mode for the Environments component
 * Controls which view is displayed (list or detail pages)
 */
export type EnvironmentViewMode =
  | { type: 'list' }
  | { type: 'workload-config' }
  | {
      type: 'overrides';
      environment: Environment;
      pendingAction?: PendingAction;
    }
  | { type: 'release-details'; environment: Environment };

// Type alias for the action tracker return type
export type ItemActionTracker = ReturnType<typeof useItemActionTracker<string>>;

/**
 * Consolidated action trackers for environment operations
 */
export interface ActionTrackers {
  promotionTracker: ItemActionTracker;
  suspendTracker: ItemActionTracker;
  rolloutRestartTracker?: ItemActionTracker;
  removeDeploymentTracker?: ItemActionTracker;
}

/**
 * Props for the NotificationBanner component
 */
export interface NotificationBannerProps {
  notification: Notification | null;
}

/**
 * Props for the LoadingSkeleton component
 */
export interface LoadingSkeletonProps {
  variant: 'card' | 'setup';
}

/**
 * Props for the SetupCard component
 */
export interface SetupCardProps {
  loading: boolean;
  environmentsExist: boolean;
  isWorkloadEditorSupported: boolean;
  onConfigureWorkload: () => void;
  /** Compact rendering for the deploy minimap canvas. */
  compact?: boolean;
  /** Selection chrome for compact mode (canvas tile selection). */
  selected?: boolean;
}

/**
 * Props for the EnvironmentCardHeader component
 */
export interface EnvironmentCardHeaderProps {
  environmentName: string;
  hasReleaseName: boolean;
  hasOverrides: boolean;
  isRefreshing: boolean;
  onOpenOverrides: () => void;
  onRefresh: () => void;
}

/**
 * Props for the EnvironmentActions component
 */
export interface EnvironmentActionsProps {
  environmentName: string;
  /**
   * Kubernetes resource name of the environment (e.g. "production"). When
   * omitted, `environmentName` is used. The ABAC permission check needs the
   * resource name because cluster CEL expressions match against it.
   */
  environmentResourceName?: string;
  bindingName?: string;
  deploymentStatus?: 'Ready' | 'NotReady' | 'Failed';
  statusReason?: string;
  releaseName?: string;
  suspendTracker: ItemActionTracker;
  rolloutRestartTracker?: ItemActionTracker;
  /**
   * Permission gate for the Rollout restart button. Backed by
   * `releasebinding:update` — passed in by the parent (which already has
   * the same permission for Undeploy/Redeploy) to avoid duplicating the
   * hook call inside this component.
   */
  canRolloutRestart?: boolean;
  rolloutRestartDeniedTooltip?: string;
  onSuspend: () => Promise<void>;
  onRedeploy: () => Promise<void>;
  onRolloutRestart?: () => void | Promise<void>;
}
