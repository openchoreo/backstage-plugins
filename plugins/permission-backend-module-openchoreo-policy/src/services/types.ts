import type {
  UserCapabilitiesResponse,
  SubjectContext,
  ActionCapability,
  CapabilityResource,
} from '@openchoreo/backstage-plugin-common';

/**
 * Response from the /authz/profile API.
 */
export type { UserCapabilitiesResponse };

/**
 * Subject context from the capabilities response.
 */
export type { SubjectContext };

/**
 * Action capability from the capabilities response.
 */
export type { ActionCapability };

/**
 * Capability resource representing a path where an action is allowed/denied.
 */
export type { CapabilityResource };

/**
 * Scope for permission evaluation.
 */
export interface OpenChoreoScope {
  /** Namespace name (required) */
  namespace: string;
  /** Project name (optional) */
  project?: string;
  /** Component name (optional) */
  component?: string;
  /** Namespace units (optional) */
  namespaceUnits?: string[];
}
