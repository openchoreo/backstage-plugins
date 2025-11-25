import { Environment } from './useEnvironmentData';

/**
 * Check if source environment has already been promoted to target.
 * Compares release names between environments.
 */
export function isAlreadyPromoted(
  sourceEnv: Environment,
  targetEnvName: string,
  allEnvironments: Environment[],
): boolean {
  const targetEnv = allEnvironments.find(e => e.name === targetEnvName);

  if (!sourceEnv.deployment.releaseName || !targetEnv?.deployment.releaseName) {
    return false;
  }

  return sourceEnv.deployment.releaseName === targetEnv.deployment.releaseName;
}
