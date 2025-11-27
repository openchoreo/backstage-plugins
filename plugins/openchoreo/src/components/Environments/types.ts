import { useItemActionTracker } from '../../hooks';
import { Notification } from '../../hooks/useNotification';
import type { Environment } from './hooks/useEnvironmentData';

// Re-export Environment type from the data hook
export type { Environment } from './hooks/useEnvironmentData';
export type { Environment as EnvironmentType } from './hooks/useEnvironmentData';

/**
 * Pending action context when redirecting to overrides page
 */
export interface PendingDeployAction {
  type: 'deploy';
  releaseName: string;
  targetEnvironment: string;
}

export interface PendingPromoteAction {
  type: 'promote';
  releaseName: string;
  sourceEnvironment: string;
  targetEnvironment: string;
}

export type PendingAction = PendingDeployAction | PendingPromoteAction;

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
 * Props for the EnvironmentCardContent component
 */
export interface EnvironmentCardContentProps {
  status?: 'Ready' | 'NotReady' | 'Failed';
  lastDeployed?: string;
  image?: string;
  releaseName?: string;
  endpoints: Array<{
    name: string;
    type: string;
    url: string;
    visibility: string;
  }>;
  onOpenReleaseDetails: () => void;
}

/**
 * Props for the EnvironmentActions component
 */
export interface EnvironmentActionsProps {
  environmentName: string;
  bindingName?: string;
  deploymentStatus?: 'Ready' | 'NotReady' | 'Failed';
  releaseName?: string;
  promotionTargets?: Array<{
    name: string;
    requiresApproval?: boolean;
  }>;
  isAlreadyPromoted: (targetEnvName: string) => boolean;
  promotionTracker: ItemActionTracker;
  suspendTracker: ItemActionTracker;
  onPromote: (targetEnvName: string) => Promise<void>;
  onSuspend: () => Promise<void>;
}

/**
 * Props for the EnvironmentCard component
 */
export interface EnvironmentCardProps {
  environmentName: string;
  resourceName?: string;
  bindingName?: string;
  hasComponentTypeOverrides?: boolean;
  deployment: {
    status?: 'Ready' | 'NotReady' | 'Failed';
    lastDeployed?: string;
    image?: string;
    releaseName?: string;
  };
  endpoints: Array<{
    name: string;
    type: string;
    url: string;
    visibility: string;
  }>;
  promotionTargets?: Array<{
    name: string;
    requiresApproval?: boolean;
  }>;
  isRefreshing: boolean;
  isAlreadyPromoted: (targetEnvName: string) => boolean;
  actionTrackers: ActionTrackers;
  onRefresh: () => void;
  onOpenOverrides: () => void;
  onOpenReleaseDetails: () => void;
  onPromote: (targetEnvName: string) => Promise<void>;
  onSuspend: () => Promise<void>;
}
