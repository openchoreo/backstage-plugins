import { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

/** Visibilities an Endpoint can route to; project-only endpoints are refused. */
const ROUTABLE_VISIBILITIES = ['internal', 'external'];

/** Placeholder the catalog stores for a workload endpoint without a schema. */
const NO_SCHEMA = 'No schema available';

/** A component workload endpoint an Endpoint can route to. */
export interface WorkloadEndpointOption {
  component: string;
  endpoint: string;
  visibility: string[];
  /** Schema format, e.g. `openapi` or `proto`, when the endpoint has one. */
  schemaType?: string;
  /** Schema document, when the endpoint has one. */
  schemaContent?: string;
}

/**
 * Reads the project form value (`{ project_name, namespace_name }`) that
 * ProjectNamespaceField writes, stripping any entity-ref prefix.
 */
export function readProjectNamespace(
  formData: Record<string, any> | undefined,
  field: string,
): { project?: string; namespace?: string } {
  const value = formData?.[field] ?? {};
  const bare = (v: unknown) =>
    typeof v === 'string' && v ? v.split('/').pop() : undefined;
  return {
    project: bare(value.project_name),
    namespace: bare(value.namespace_name),
  };
}

export function toWorkloadEndpointOption(
  api: Entity,
): WorkloadEndpointOption | undefined {
  const annotations = api.metadata.annotations ?? {};
  const component = annotations[CHOREO_ANNOTATIONS.COMPONENT];
  const endpoint = annotations[CHOREO_ANNOTATIONS.ENDPOINT_NAME];
  if (!component || !endpoint) return undefined;
  const definition = (api.spec as { definition?: string } | undefined)
    ?.definition;
  const hasSchema = !!definition && definition !== NO_SCHEMA;
  return {
    component,
    endpoint,
    visibility: (annotations[CHOREO_ANNOTATIONS.ENDPOINT_VISIBILITY] ?? '')
      .split(',')
      .map(v => v.trim())
      .filter(Boolean),
    ...(hasSchema && {
      schemaType: (api.spec as { type?: string }).type,
      schemaContent: definition,
    }),
  };
}

export function isRoutable(option: WorkloadEndpointOption): boolean {
  return option.visibility.some(v => ROUTABLE_VISIBILITIES.includes(v));
}

/**
 * Lists the workload endpoints of a project's components, read from the API
 * entities the catalog keeps for each workload endpoint. Endpoint-backed API
 * entities have no component annotation and are skipped.
 */
export function useProjectWorkloadEndpoints(
  namespace: string | undefined,
  project: string | undefined,
): {
  options: WorkloadEndpointOption[];
  loading: boolean;
  error?: Error;
} {
  const catalogApi = useApi(catalogApiRef);
  const [state, setState] = useState<{
    options: WorkloadEndpointOption[];
    loading: boolean;
    error?: Error;
  }>({ options: [], loading: false });

  useEffect(() => {
    if (!namespace || !project) {
      setState({ options: [], loading: false });
      return undefined;
    }
    let cancelled = false;
    setState(prev => ({ ...prev, loading: true, error: undefined }));
    catalogApi
      .getEntities({
        filter: {
          kind: 'API',
          'metadata.namespace': namespace,
          [`metadata.annotations.${CHOREO_ANNOTATIONS.PROJECT}`]: project,
        },
      })
      .then(({ items }) => {
        if (cancelled) return;
        const options = items
          .map(toWorkloadEndpointOption)
          .filter((o): o is WorkloadEndpointOption => o !== undefined)
          .sort((a, b) =>
            `${a.component}/${a.endpoint}`.localeCompare(
              `${b.component}/${b.endpoint}`,
            ),
          );
        setState({ options, loading: false });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          options: [],
          loading: false,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [catalogApi, namespace, project]);

  return state;
}
