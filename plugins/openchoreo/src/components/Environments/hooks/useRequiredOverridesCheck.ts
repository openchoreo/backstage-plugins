import { useState, useCallback } from 'react';
import { JSONSchema7 } from 'json-schema';
import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import {
  openChoreoClientApiRef,
  ReleaseBinding,
} from '../../../api/OpenChoreoClientApi';
import { getMissingRequiredFields } from '../overridesUtils';

export interface RequiredOverridesCheckResult {
  /** Whether the schema defines any required fields */
  hasRequiredOverrides: boolean;
  /** Field names that are required but missing from the binding */
  missingRequiredFields: string[];
  /** Whether validation is in progress */
  isLoading: boolean;
  /** Error message if validation failed */
  error: string | null;
}

interface UseRequiredOverridesCheckReturn extends RequiredOverridesCheckResult {
  /**
   * Check required overrides for a specific release and environment.
   * @param releaseName - The release to check schema for
   * @param environmentName - The environment to check binding for
   * @returns Promise resolving to missing required fields
   */
  checkRequiredOverrides: (
    releaseName: string,
    environmentName: string,
  ) => Promise<string[]>;
  /** Reset the check state */
  reset: () => void;
}

/**
 * Hook for checking if required ComponentType envOverrides are missing
 * from a release binding for a specific environment.
 *
 * Usage:
 * - Call checkRequiredOverrides(releaseName, envName) before deploy/promote
 * - If missingRequiredFields.length > 0, redirect user to configure overrides
 */
export function useRequiredOverridesCheck(
  entity: Entity,
): UseRequiredOverridesCheckReturn {
  const client = useApi(openChoreoClientApiRef);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRequiredOverrides, setHasRequiredOverrides] = useState(false);
  const [missingRequiredFields, setMissingRequiredFields] = useState<string[]>(
    [],
  );

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setHasRequiredOverrides(false);
    setMissingRequiredFields([]);
  }, []);

  const checkRequiredOverrides = useCallback(
    async (releaseName: string, environmentName: string): Promise<string[]> => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch the schema for this release
        const schemaResponse = await client.fetchComponentReleaseSchema(
          entity,
          releaseName,
        );

        if (!schemaResponse.success || !schemaResponse.data) {
          // No schema available - treat as no required fields
          setHasRequiredOverrides(false);
          setMissingRequiredFields([]);
          return [];
        }

        // Extract componentTypeEnvOverrides schema
        const wrappedSchema = schemaResponse.data as {
          properties?: {
            componentTypeEnvOverrides?: JSONSchema7;
          };
        };
        const componentTypeSchema =
          wrappedSchema.properties?.componentTypeEnvOverrides;

        // Check if schema has any required fields
        const requiredFields =
          componentTypeSchema?.required &&
          Array.isArray(componentTypeSchema.required)
            ? (componentTypeSchema.required as string[])
            : [];

        if (requiredFields.length === 0) {
          // No required fields in schema
          setHasRequiredOverrides(false);
          setMissingRequiredFields([]);
          return [];
        }

        setHasRequiredOverrides(true);

        // Fetch existing release bindings to get current overrides
        const bindingsResponse = await client.fetchReleaseBindings(entity);

        let currentOverrides: Record<string, unknown> = {};

        if (bindingsResponse.success && bindingsResponse.data?.items) {
          const bindings = bindingsResponse.data.items as ReleaseBinding[];
          const currentBinding = bindings.find(
            b => b.environment.toLowerCase() === environmentName.toLowerCase(),
          );

          if (currentBinding?.componentTypeEnvOverrides) {
            currentOverrides =
              currentBinding.componentTypeEnvOverrides as Record<
                string,
                unknown
              >;
          }
        }

        // Calculate missing required fields
        const missing = getMissingRequiredFields(
          componentTypeSchema,
          currentOverrides,
        );
        setMissingRequiredFields(missing);

        return missing;
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to check required overrides';
        setError(errorMessage);
        // On error, don't block - return empty array to allow action
        setMissingRequiredFields([]);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [entity, client],
  );

  return {
    hasRequiredOverrides,
    missingRequiredFields,
    isLoading,
    error,
    checkRequiredOverrides,
    reset,
  };
}
