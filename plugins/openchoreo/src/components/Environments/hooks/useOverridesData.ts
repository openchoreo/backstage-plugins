import { useState, useCallback, useEffect } from 'react';
import { JSONSchema7 } from 'json-schema';
import { Entity } from '@backstage/catalog-model';
import { DiscoveryApi, IdentityApi } from '@backstage/core-plugin-api';
import {
  fetchComponentReleaseSchema,
  fetchReleaseBindings,
} from '../../../api/environments';
import { fetchWorkloadInfo } from '../../../api/workloadInfo';

interface ReleaseBinding {
  name: string;
  environment: string;
  componentTypeEnvOverrides?: Record<string, unknown>;
  traitOverrides?: Record<string, Record<string, unknown>>;
  workloadOverrides?: {
    containers?: { [key: string]: any };
  };
}

export interface OverridesFormState {
  componentTypeFormData: Record<string, unknown>;
  traitFormDataMap: Record<string, Record<string, unknown>>;
  initialComponentTypeFormData: Record<string, unknown>;
  initialTraitFormDataMap: Record<string, Record<string, unknown>>;
  initialWorkloadFormData: Record<string, unknown>;
  workloadFormData: any;
}

export interface OverridesSchemaState {
  componentTypeSchema: JSONSchema7 | null;
  traitSchemasMap: Record<string, JSONSchema7>;
}

interface UseOverridesDataReturn {
  loading: boolean;
  error: string | null;
  schemas: OverridesSchemaState;
  formState: OverridesFormState;
  expandedSections: Record<string, boolean>;
  setComponentTypeFormData: (data: Record<string, unknown>) => void;
  setTraitFormDataMap: React.Dispatch<
    React.SetStateAction<Record<string, Record<string, unknown>>>
  >;
  setExpandedSections: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  setWorkloadFormData: (data: any) => void;
  reload: () => void;
}

/**
 * Hook for loading and managing environment overrides data.
 * Fetches schema and existing bindings for an environment.
 */
export function useOverridesData(
  entity: Entity,
  discovery: DiscoveryApi,
  identityApi: IdentityApi,
  environmentName: string | undefined,
  releaseName: string | undefined,
  isOpen: boolean,
): UseOverridesDataReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Schema state
  const [componentTypeSchema, setComponentTypeSchema] =
    useState<JSONSchema7 | null>(null);
  const [traitSchemasMap, setTraitSchemasMap] = useState<
    Record<string, JSONSchema7>
  >({});

  // Form data state
  const [componentTypeFormData, setComponentTypeFormData] = useState<
    Record<string, unknown>
  >({});
  const [traitFormDataMap, setTraitFormDataMap] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const [initialComponentTypeFormData, setInitialComponentTypeFormData] =
    useState<Record<string, unknown>>({});
  const [initialTraitFormDataMap, setInitialTraitFormDataMap] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const [workloadFormData, setWorkloadFormData] = useState<any>({});
  const [initialWorkloadFormData, setInitialWorkloadFormData] = useState<any>(
    {},
  );

  // Accordion state
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({ component: true, workload: false });

  // Helper function to create empty containers structure from workload info
  const createContainersFromWorkload = (workloadInfo: any) => {
    if (workloadInfo?.containers) {
      const containers: any = {};
      Object.keys(workloadInfo.containers).forEach(containerName => {
        containers[containerName] = {
          env: [],
          files: [],
        };
      });
      return { containers };
    }
    return null;
  };

  const loadSchemaAndBinding = useCallback(async () => {
    if (!releaseName) {
      setError('No release deployed to this environment');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch schema for the release
      const schemaResponse = await fetchComponentReleaseSchema(
        entity,
        discovery,
        identityApi,
        releaseName,
      );

      if (schemaResponse.success && schemaResponse.data) {
        const wrappedSchema = schemaResponse.data as {
          properties?: {
            componentTypeEnvOverrides?: JSONSchema7;
            traitOverrides?: { properties?: Record<string, JSONSchema7> };
          };
        };
        const compTypeOverrides =
          wrappedSchema.properties?.componentTypeEnvOverrides;
        const traitOverrides = wrappedSchema.properties?.traitOverrides;

        if (compTypeOverrides) {
          setComponentTypeSchema(compTypeOverrides as JSONSchema7);
        }

        if (traitOverrides?.properties) {
          const traitSchemas: Record<string, JSONSchema7> = {};
          Object.entries(traitOverrides.properties).forEach(
            ([traitName, schema]) => {
              traitSchemas[traitName] = schema as JSONSchema7;
            },
          );
          setTraitSchemasMap(traitSchemas);

          // Initialize expanded state for each trait
          const newExpandedSections: Record<string, boolean> = {
            component: true,
            workload: false,
          };
          Object.keys(traitSchemas).forEach(traitName => {
            newExpandedSections[`trait-${traitName}`] = false;
          });
          setExpandedSections(newExpandedSections);
        }
      } else {
        throw new Error('Failed to fetch schema');
      }

      // Fetch existing bindings to get current overrides
      const bindingsResponse = await fetchReleaseBindings(
        entity,
        discovery,
        identityApi,
      );

      if (bindingsResponse.success && bindingsResponse.data?.items) {
        const bindings = bindingsResponse.data.items as ReleaseBinding[];
        const currentBinding = bindings.find(
          b => b.environment.toLowerCase() === environmentName?.toLowerCase(),
        );

        if (currentBinding) {
          const componentOverrides =
            currentBinding.componentTypeEnvOverrides || {};
          setComponentTypeFormData(componentOverrides);
          setInitialComponentTypeFormData(componentOverrides);

          const existingTraitOverrides = currentBinding.traitOverrides || {};
          setTraitFormDataMap(existingTraitOverrides);
          setInitialTraitFormDataMap(existingTraitOverrides);

          const workloadOverrides = currentBinding.workloadOverrides || {};
          // If no workload overrides exist, fetch workload info to populate container structure
          if (
            !workloadOverrides.containers ||
            Object.keys(workloadOverrides.containers).length === 0
          ) {
            const workloadInfo = await fetchWorkloadInfo(
              entity,
              discovery,
              identityApi,
            );
            const populatedWorkloadOverrides =
              createContainersFromWorkload(workloadInfo);
            if (populatedWorkloadOverrides) {
              setWorkloadFormData(populatedWorkloadOverrides);
              setInitialWorkloadFormData(populatedWorkloadOverrides);
            } else {
              setWorkloadFormData(workloadOverrides);
              setInitialWorkloadFormData(workloadOverrides);
            }
          } else {
            setWorkloadFormData(workloadOverrides);
            setInitialWorkloadFormData(workloadOverrides);
          }
        } else {
          setComponentTypeFormData({});
          setInitialComponentTypeFormData({});
          setTraitFormDataMap({});
          setInitialTraitFormDataMap({});
          setWorkloadFormData({});
          setInitialWorkloadFormData({});
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [entity, discovery, identityApi, environmentName, releaseName]);

  useEffect(() => {
    if (isOpen && environmentName) {
      loadSchemaAndBinding();
    }
  }, [isOpen, environmentName, loadSchemaAndBinding]);

  return {
    loading,
    error,
    schemas: {
      componentTypeSchema,
      traitSchemasMap,
    },
    formState: {
      componentTypeFormData,
      traitFormDataMap,
      initialComponentTypeFormData,
      initialTraitFormDataMap,
      initialWorkloadFormData,
      workloadFormData,
    },
    expandedSections,
    setComponentTypeFormData,
    setTraitFormDataMap,
    setExpandedSections,
    setWorkloadFormData,
    reload: loadSchemaAndBinding,
  };
}
