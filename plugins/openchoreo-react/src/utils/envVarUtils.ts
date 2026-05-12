import type {
  EnvVar,
  ModelsWorkload,
} from '@openchoreo/backstage-plugin-common';

/**
 * Status of an environment variable in the override context.
 * - 'inherited': From base workload, not overridden
 * - 'overridden': Has a base value that is being overridden
 * - 'extra': In the persisted overrides but not in the base workload (e.g. a
 *   stale entry left over after the bound release changed)
 * - 'new': Added by the user in the current form session and not in base
 */
export type EnvVarStatus = 'inherited' | 'overridden' | 'extra' | 'new';

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
 * Returns status for each: inherited, overridden, extra, or new.
 *
 * When `initialOverrideEnvVars` is provided, an override key not in `base` is
 * tagged `'extra'` if it was already in `initial` (i.e. loaded from the
 * binding) and `'new'` otherwise (i.e. added in the current form session).
 * When omitted, everything not-in-base falls back to `'new'` for backwards
 * compatibility with legacy callers.
 *
 * @param baseEnvVars - Environment variables from the base workload
 * @param overrideEnvVars - Environment variables from the override form
 * @param initialOverrideEnvVars - Snapshot of overrides as initially loaded
 */
export function mergeEnvVarsWithStatus(
  baseEnvVars: EnvVar[],
  overrideEnvVars: EnvVar[],
  initialOverrideEnvVars?: EnvVar[],
): EnvVarWithStatus[] {
  const result: EnvVarWithStatus[] = [];
  const baseMap = new Map(baseEnvVars.map(e => [e.key, e]));
  const initialKeys = initialOverrideEnvVars
    ? new Set(initialOverrideEnvVars.map(e => e.key))
    : undefined;

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

  // Add override env vars not present in base.
  // Without an `initial` snapshot, mark every such entry 'new' (legacy).
  // With it, persisted-but-not-in-base entries become 'extra'.
  for (let i = 0; i < overrideEnvVars.length; i++) {
    const overrideEnv = overrideEnvVars[i];
    if (!baseMap.has(overrideEnv.key)) {
      const status: EnvVarStatus =
        initialKeys && initialKeys.has(overrideEnv.key) ? 'extra' : 'new';
      result.push({
        envVar: overrideEnv,
        status,
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
): EnvVar[] {
  return baseWorkload?.container?.env || [];
}

/**
 * Format an env var value for display.
 * Handles both plain values and secret references.
 *
 * @param envVar - The environment variable to format
 * @returns Display string for the value
 */
export function formatEnvVarValue(envVar: EnvVar): string {
  if (envVar.valueFrom?.secretKeyRef) {
    const { name, key } = envVar.valueFrom.secretKeyRef;
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
