import type {
  EnvVar,
  ModelsWorkload,
} from '@openchoreo/backstage-plugin-common';

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
  /** Actual index in the container.env array (only for overridden/new) */
  actualIndex?: number;
}

/**
 * Merges base workload env vars with override env vars into a unified list.
 * Returns status for each: inherited, overridden, or new.
 *
 * @param baseEnvVars - Environment variables from the base workload
 * @param overrideEnvVars - Environment variables from the override form
 * @returns Unified list with status metadata for each env var
 */
export function mergeEnvVarsWithStatus(
  baseEnvVars: EnvVar[],
  overrideEnvVars: EnvVar[],
): EnvVarWithStatus[] {
  const result: EnvVarWithStatus[] = [];
  const baseMap = new Map(baseEnvVars.map(e => [e.key, e]));

  // Create a map of override keys to their actual indices in the array
  const overrideIndexMap = new Map(
    overrideEnvVars.map((e, idx) => [e.key, idx]),
  );

  // Add base env vars first (inherited or overridden)
  for (const baseEnv of baseEnvVars) {
    const actualIndex = overrideIndexMap.get(baseEnv.key);
    if (actualIndex !== undefined) {
      result.push({
        envVar: overrideEnvVars[actualIndex],
        status: 'overridden',
        baseValue: baseEnv,
        actualIndex,
      });
    } else {
      result.push({
        envVar: baseEnv,
        status: 'inherited',
      });
    }
  }

  // Add new override env vars (not in base)
  for (let i = 0; i < overrideEnvVars.length; i++) {
    const overrideEnv = overrideEnvVars[i];
    if (!baseMap.has(overrideEnv.key)) {
      result.push({
        envVar: overrideEnv,
        status: 'new',
        actualIndex: i,
      });
    }
  }

  return result;
}

/**
 * Extract base env vars for a specific container from the workload.
 *
 * @param baseWorkload - The base workload data
 * @param containerName - Name of the container to get env vars for
 * @returns Array of env vars for the container, or empty array if not found
 */
export function getBaseEnvVarsForContainer(
  baseWorkload: ModelsWorkload | null,
  containerName: string,
): EnvVar[] {
  return baseWorkload?.containers?.[containerName]?.env || [];
}

/**
 * Format an env var value for display.
 * Handles both plain values and secret references.
 *
 * @param envVar - The environment variable to format
 * @returns Display string for the value
 */
export function formatEnvVarValue(envVar: EnvVar): string {
  if (envVar.valueFrom?.secretRef) {
    const { name, key } = envVar.valueFrom.secretRef;
    return `Secret: ${name}/${key}`;
  }
  if (envVar.value !== undefined) {
    // Mask long values or sensitive-looking keys
    const isSensitive =
      envVar.key?.toLowerCase().includes('secret') ||
      envVar.key?.toLowerCase().includes('password') ||
      envVar.key?.toLowerCase().includes('token') ||
      envVar.key?.toLowerCase().includes('key');
    if (isSensitive && envVar.value.length > 0) {
      return '••••••••';
    }
    return envVar.value;
  }
  return '';
}
