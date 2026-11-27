import type { LoggerService } from '@backstage/backend-plugin-api';
import type { OpenChoreoApiClient } from './collectOpenChoreoFacts';

/**
 * A cache for one run. A load that fails isn't kept, so a transient error
 * costs only the entity that hit it, and the next one loads again.
 */
export function perRun<V>() {
  const loads = new Map<string, Promise<V>>();
  return (key: string, load: () => Promise<V>): Promise<V> => {
    let pending = loads.get(key);
    if (!pending) {
      pending = load();
      loads.set(key, pending);
      pending.catch(() => loads.delete(key));
    }
    return pending;
  };
}

interface PlaneReference {
  kind: string;
  name: string;
}

interface PlaneSpec {
  observabilityPlaneRef?: PlaneReference;
  observerURL?: string;
}

interface EnvironmentSpec {
  dataPlaneRef?: PlaneReference;
  isProduction?: boolean;
}

/** What an environment's entry reports about it. */
export interface EnvironmentObservability {
  /**
   * False when the Environment doesn't exist; undefined when it can't be
   * read.
   */
  isProduction?: boolean;
  /**
   * False when the Environment doesn't exist, no plane that could apply
   * exists at some step of the chain, or the observability plane found names
   * no observer; undefined when the Environment or a plane can't be read.
   */
  hasObservability?: boolean;
  observerUrl?: string;
}

type Response<T> = Promise<{
  data?: { spec?: T };
  response: { status: number };
}>;

const DEFAULT_PLANE = 'default';

/**
 * Resolves the observer of an environment through Environment, DataPlane or
 * ClusterDataPlane, and ObservabilityPlane or ClusterObservabilityPlane, with
 * each resource read once per run and every request under the entity's
 * signal. A missing ref falls back the way OpenChoreo renders releases
 * (`GetDataPlaneFromRef` and `GetObservabilityPlaneFromRef` in
 * internal/controller/reference.go): a namespaced referrer tries the
 * namespace's `default` plane, then the cluster's; a cluster-scoped one tries
 * only the cluster's.
 */
export function observabilityResolver(
  client: OpenChoreoApiClient,
  logger: LoggerService,
) {
  const environments = perRun<EnvironmentSpec | null>();
  const planes = perRun<PlaneSpec | null>();

  /** The resource's spec, null on a 404; throws on any other failure. */
  async function specOf<T>(what: string, request: () => Response<T>) {
    const { data, response } = await request();
    if (response.status === 404) {
      return null;
    }
    if (!data) {
      throw new Error(`GET ${what} returned HTTP ${response.status}`);
    }
    return (data.spec ?? {}) as T;
  }

  const namespacedDataPlane = (
    namespaceName: string,
    dpName: string,
    signal: AbortSignal,
  ) =>
    planes(`DataPlane/${namespaceName}/${dpName}`, () =>
      specOf<PlaneSpec>(`DataPlane ${dpName}`, () =>
        client.GET('/api/v1/namespaces/{namespaceName}/dataplanes/{dpName}', {
          params: { path: { namespaceName, dpName } },
          signal,
        }),
      ),
    );

  const clusterDataPlane = (cdpName: string, signal: AbortSignal) =>
    planes(`ClusterDataPlane/${cdpName}`, () =>
      specOf<PlaneSpec>(`ClusterDataPlane ${cdpName}`, () =>
        client.GET('/api/v1/clusterdataplanes/{cdpName}', {
          params: { path: { cdpName } },
          signal,
        }),
      ),
    );

  const namespacedObservabilityPlane = (
    namespaceName: string,
    observabilityPlaneName: string,
    signal: AbortSignal,
  ) =>
    planes(
      `ObservabilityPlane/${namespaceName}/${observabilityPlaneName}`,
      () =>
        specOf<PlaneSpec>(`ObservabilityPlane ${observabilityPlaneName}`, () =>
          client.GET(
            '/api/v1/namespaces/{namespaceName}/observabilityplanes/{observabilityPlaneName}',
            {
              params: { path: { namespaceName, observabilityPlaneName } },
              signal,
            },
          ),
        ),
    );

  const clusterObservabilityPlane = (
    clusterObservabilityPlaneName: string,
    signal: AbortSignal,
  ) =>
    planes(`ClusterObservabilityPlane/${clusterObservabilityPlaneName}`, () =>
      specOf<PlaneSpec>(
        `ClusterObservabilityPlane ${clusterObservabilityPlaneName}`,
        () =>
          client.GET(
            '/api/v1/clusterobservabilityplanes/{clusterObservabilityPlaneName}',
            { params: { path: { clusterObservabilityPlaneName } }, signal },
          ),
      ),
    );

  async function dataPlane(
    namespaceName: string,
    ref: PlaneReference | undefined,
    signal: AbortSignal,
  ): Promise<{ spec: PlaneSpec; clusterScoped: boolean } | null> {
    if (ref?.kind === 'ClusterDataPlane') {
      const spec = await clusterDataPlane(ref.name, signal);
      return spec && { spec, clusterScoped: true };
    }
    if (ref && ref.kind !== 'DataPlane') {
      throw new Error(`unsupported dataPlaneRef kind ${ref.kind}`);
    }
    const namespaced = await namespacedDataPlane(
      namespaceName,
      ref?.name ?? DEFAULT_PLANE,
      signal,
    );
    if (namespaced || ref) {
      return namespaced && { spec: namespaced, clusterScoped: false };
    }
    const cluster = await clusterDataPlane(DEFAULT_PLANE, signal);
    return cluster && { spec: cluster, clusterScoped: true };
  }

  async function observabilityPlane(
    namespaceName: string,
    ref: PlaneReference | undefined,
    clusterScopedReferrer: boolean,
    signal: AbortSignal,
  ): Promise<PlaneSpec | null> {
    if (ref?.kind === 'ClusterObservabilityPlane') {
      return clusterObservabilityPlane(ref.name, signal);
    }
    if (ref && ref.kind !== 'ObservabilityPlane') {
      throw new Error(`unsupported observabilityPlaneRef kind ${ref.kind}`);
    }
    if (ref) {
      return namespacedObservabilityPlane(namespaceName, ref.name, signal);
    }
    if (!clusterScopedReferrer) {
      const namespaced = await namespacedObservabilityPlane(
        namespaceName,
        DEFAULT_PLANE,
        signal,
      );
      if (namespaced) {
        return namespaced;
      }
    }
    return clusterObservabilityPlane(DEFAULT_PLANE, signal);
  }

  return async (
    namespaceName: string,
    environmentName: string,
    signal: AbortSignal,
  ): Promise<EnvironmentObservability> => {
    let environment: EnvironmentSpec | null;
    try {
      environment = await environments(
        `${namespaceName}/${environmentName}`,
        () =>
          specOf<EnvironmentSpec>(`environment ${environmentName}`, () =>
            client.GET(
              '/api/v1/namespaces/{namespaceName}/environments/{envName}',
              {
                params: { path: { namespaceName, envName: environmentName } },
                signal,
              },
            ),
          ),
      );
    } catch (error) {
      logger.warn(
        `Leaving out what's known about environment ${namespaceName}/${environmentName}: ${
          (error as Error).message
        }`,
      );
      return {};
    }
    if (!environment) {
      return { isProduction: false, hasObservability: false };
    }

    const isProduction = Boolean(environment.isProduction);
    try {
      const plane = await dataPlane(
        namespaceName,
        environment.dataPlaneRef,
        signal,
      );
      if (!plane) {
        return { isProduction, hasObservability: false };
      }
      const observability = await observabilityPlane(
        namespaceName,
        plane.spec.observabilityPlaneRef,
        plane.clusterScoped,
        signal,
      );
      return observability?.observerURL
        ? {
            isProduction,
            hasObservability: true,
            observerUrl: observability.observerURL,
          }
        : { isProduction, hasObservability: false };
    } catch (error) {
      logger.warn(
        `Leaving out whether environment ${namespaceName}/${environmentName} has observability: ${
          (error as Error).message
        }`,
      );
      return { isProduction };
    }
  };
}
