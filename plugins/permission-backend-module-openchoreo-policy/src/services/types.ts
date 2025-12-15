import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';

/**
 * Response from the /authz/profile API.
 */
export type UserCapabilitiesResponse =
  OpenChoreoComponents['schemas']['UserCapabilitiesResponse'];

/**
 * Subject context from the capabilities response.
 */
export type SubjectContext = OpenChoreoComponents['schemas']['SubjectContext'];

/**
 * Action capability from the capabilities response.
 */
export type ActionCapability =
  OpenChoreoComponents['schemas']['ActionCapability'];

/**
 * Capability resource representing a path where an action is allowed/denied.
 */
export type CapabilityResource =
  OpenChoreoComponents['schemas']['CapabilityResource'];

/**
 * Scope for permission evaluation.
 */
export interface OpenChoreoScope {
  /** Organization name (required) */
  org: string;
  /** Project name (optional) */
  project?: string;
  /** Component name (optional) */
  component?: string;
  /** Organization units (optional) */
  orgUnits?: string[];
}
