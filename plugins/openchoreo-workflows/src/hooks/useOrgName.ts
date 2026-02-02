import { useApi, configApiRef } from '@backstage/core-plugin-api';

/**
 * Hook to get the namespace name from config.
 * Returns the namespace from openchoreo.namespace config.
 *
 * After the Organization CRD removal, the hierarchy is now:
 * Namespace → Project → Component
 */
export function useNamespace(): string {
  const configApi = useApi(configApiRef);
  const namespace = configApi.getOptionalString('openchoreo.namespace');

  if (!namespace) {
    throw new Error(
      'Namespace not configured. Please set openchoreo.namespace in app-config.yaml',
    );
  }

  return namespace;
}

/**
 * @deprecated Use useNamespace instead. This is kept for backward compatibility.
 */
export function useOrgName(): string {
  return useNamespace();
}
