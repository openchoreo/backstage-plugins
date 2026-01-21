/**
 * Status of an entity in OpenChoreo.
 */
export type EntityStatus = 'exists' | 'not-found' | 'marked-for-deletion';

/**
 * Result of checking if an entity exists in OpenChoreo.
 */
export interface EntityExistsCheckResult {
  /** Whether the check is still in progress */
  loading: boolean;
  /** Status of the entity in OpenChoreo */
  status: EntityStatus | null;
  /** Message to display (for not-found or marked-for-deletion states) */
  message: string | null;
}
