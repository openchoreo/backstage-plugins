import type {
  EnvVar,
  ModelsWorkload,
} from '@openchoreo/backstage-plugin-common';
import type { EnvVarWithStatus } from '../types/envVarTypes';

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
  const overrideMap = new Map(overrideEnvVars.map(e => [e.key, e]));

  // Add base env vars first (inherited or overridden)
  for (const baseEnv of baseEnvVars) {
    const override = overrideMap.get(baseEnv.key);
    if (override) {
      result.push({
        envVar: override,
        status: 'overridden',
        baseValue: baseEnv,
      });
    } else {
      result.push({
        envVar: baseEnv,
        status: 'inherited',
      });
    }
  }

  // Add new override env vars (not in base)
  for (const overrideEnv of overrideEnvVars) {
    if (!baseMap.has(overrideEnv.key)) {
      result.push({
        envVar: overrideEnv,
        status: 'new',
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
