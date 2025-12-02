import type { EnvVar } from '@openchoreo/backstage-plugin-common';

/**
 * Status of an environment variable in the override context.
 * - 'inherited': From base workload, not overridden
 * - 'overridden': Has a base value that is being overridden
 * - 'new': New env var added in override, not in base workload
 */
export type EnvVarStatus = 'inherited' | 'overridden' | 'new';

/**
 * Environment variable with its override status metadata.
 */
export interface EnvVarWithStatus {
  /** The environment variable data */
  envVar: EnvVar;
  /** The status indicating if it's inherited, overridden, or new */
  status: EnvVarStatus;
  /** Original base value if status is 'overridden' */
  baseValue?: EnvVar;
}
