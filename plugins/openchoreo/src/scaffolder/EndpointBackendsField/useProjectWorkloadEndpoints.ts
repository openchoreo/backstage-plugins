import { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';

/**
 * A component workload endpoint an Endpoint can route to. Any workload
 * endpoint can be a backend: who can reach it comes from the Endpoint's
 * visibility, not the workload's (deprecated) one.
 */
export interface WorkloadEndpointOption {
  component: string;
  endpoint: string;
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

/** Workload endpoint fields this field reads, as served by the BFF. */
interface WorkloadEndpointSpec {
  schema?: { type?: string; content?: string };
}

/**
 * Lists a component's workload endpoints from its Workload's
 * `spec.endpoints`. The Workload is the source of truth: endpoints without a
 * schema have no API entity in the catalog, so the catalog alone would miss
 * them.
 */
export function workloadEndpointOptions(
  component: string,
  endpoints: Record<string, WorkloadEndpointSpec> | undefined,
): WorkloadEndpointOption[] {
  return Object.entries(endpoints ?? {}).map(([endpoint, spec]) => ({
    component,
    endpoint,
    ...(spec.schema?.content && {
      schemaType: spec.schema.type,
      schemaContent: spec.schema.content,
    }),
  }));
}

/** Identifies the project a set of options was loaded for. */
export function projectKey(namespace: string, project: string): string {
  return `${namespace}/${project}`;
}

/**
 * Lists the workload endpoints of a project's components: the components come
 * from the catalog, their endpoints from each component's Workload. A
 * component without a Workload contributes no endpoints. `loadedFor` is the
 * {@link projectKey} the options were loaded for, set once they have loaded,
 * so callers can tell them from options still left over from another project.
 */
export function useProjectWorkloadEndpoints(
  namespace: string | undefined,
  project: string | undefined,
): {
  options: WorkloadEndpointOption[];
  loading: boolean;
  error?: Error;
  loadedFor?: string;
} {
  const catalogApi = useApi(catalogApiRef);
  const client = useApi(openChoreoClientApiRef);
  const [state, setState] = useState<{
    options: WorkloadEndpointOption[];
    loading: boolean;
    error?: Error;
    loadedFor?: string;
  }>({ options: [], loading: false });

  useEffect(() => {
    if (!namespace || !project) {
      setState({ options: [], loading: false });
      return undefined;
    }
    let cancelled = false;
    const key = projectKey(namespace, project);
    setState(prev => ({ ...prev, loading: true, error: undefined }));
    catalogApi
      .getEntities({
        filter: {
          kind: 'Component',
          'metadata.namespace': namespace,
          [`metadata.annotations.${CHOREO_ANNOTATIONS.PROJECT}`]: project,
        },
      })
      .then(({ items }) =>
        Promise.all(
          items.map(component =>
            client
              .fetchWorkloadInfo(component)
              .then(workload =>
                workloadEndpointOptions(
                  component.metadata.annotations?.[
                    CHOREO_ANNOTATIONS.COMPONENT
                  ] ?? component.metadata.name,
                  workload?.spec?.endpoints as
                    | Record<string, WorkloadEndpointSpec>
                    | undefined,
                ),
              )
              // No Workload yet (or not readable): nothing to route to.
              .catch(() => [] as WorkloadEndpointOption[]),
          ),
        ),
      )
      .then(perComponent => {
        if (cancelled) return;
        const options = perComponent
          .flat()
          .sort((a, b) =>
            `${a.component}/${a.endpoint}`.localeCompare(
              `${b.component}/${b.endpoint}`,
            ),
          );
        setState({ options, loading: false, loadedFor: key });
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
  }, [catalogApi, client, namespace, project]);

  return state;
}
