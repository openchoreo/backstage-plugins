import type { OpenChoreoLegacyComponents } from '@openchoreo/openchoreo-client-node';

/**
 * Response from the /authz/profile API.
 */
export type UserCapabilitiesResponse =
  OpenChoreoLegacyComponents['schemas']['UserCapabilitiesResponse'];

/**
 * Subject context from the capabilities response.
 */
export type SubjectContext =
  OpenChoreoLegacyComponents['schemas']['SubjectContext'];

/**
 * Action capability from the capabilities response.
 */
export type ActionCapability =
  OpenChoreoLegacyComponents['schemas']['ActionCapability'];

/**
 * Capability resource representing a path where an action is allowed/denied.
 */
export type CapabilityResource =
  OpenChoreoLegacyComponents['schemas']['CapabilityResource'];

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
