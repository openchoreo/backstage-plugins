import type { FactRetriever } from '@backstage-community/plugin-tech-insights-node';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import type { OpenChoreoTokenService } from '@openchoreo/openchoreo-auth';
import { fetchAllPages } from '@openchoreo/openchoreo-client-node';
import {
  collectOpenChoreoFacts,
  createServiceClient,
  isReleaseLine,
  unresolvedFacts,
  type OpenChoreoApiClient,
} from './collectOpenChoreoFacts';
import {
  componentPath,
  grantsUnconditionally,
  namespacePath,
  type ActionCapability,
} from './capabilities';
import {
  activeBindings,
  lineBindings,
  plainTextSecretEnvCount,
  releaseBindingFacts,
  workloadFacts,
  type EnvVar,
  type ReleaseBinding,
  type WorkloadSpec,
} from './deploymentFacts';

export const OPENCHOREO_DEPLOYMENT_FACT_RETRIEVER_ID =
  'openchoreoDeploymentFactRetriever';

interface NamespaceContext {
  capabilities: Record<string, ActionCapability>;
  /**
   * Undefined when the caller may not see every environment, since a
   * hidden production environment would make a production deployment
   * look like none.
   */
  productionEnvironments?: Set<string>;
}

/** Reads the authz profile and production environments of a namespace. */
async function loadNamespace(
  client: OpenChoreoApiClient,
  namespaceName: string,
  signal: AbortSignal,
): Promise<NamespaceContext> {
  const profile = await client.GET('/api/v1/authz/profile', {
    params: { query: { namespace: namespaceName } },
    signal,
  });
  if (!profile.data) {
    throw new Error(
      `GET authz profile for namespace ${namespaceName} returned HTTP ${profile.response.status}`,
    );
  }
  const capabilities = (profile.data.capabilities ?? {}) as Record<
    string,
    ActionCapability
  >;
  // Returned rather than thrown: a throw drops the cached load, so every
  // entity in the namespace would fetch the profile again.
  if (
    !grantsUnconditionally(
      capabilities,
      'environment:view',
      namespacePath(namespaceName),
    )
  ) {
    return { capabilities };
  }

  const environments = await fetchAllPages(cursor =>
    client
      .GET('/api/v1/namespaces/{namespaceName}/environments', {
        params: { path: { namespaceName }, query: { cursor } },
        signal,
      })
      .then(({ data, response }) => {
        if (!data) {
          throw new Error(
            `GET environments in ${namespaceName} returned HTTP ${response.status}`,
          );
        }
        return data;
      }),
  );
  return {
    capabilities,
    productionEnvironments: new Set(
      environments
        .filter(environment => environment.spec?.isProduction)
        .map(environment => environment.metadata.name),
    ),
  };
}

/**
 * Namespace contexts for one run. A failed load isn't kept, so one
 * transient error costs only the entity that hit it. A load runs under the
 * deadline of the entity that started it; if that runs out, the next entity
 * in the namespace loads it again.
 */
function namespaceLoader(client: OpenChoreoApiClient) {
  const loads = new Map<string, Promise<NamespaceContext>>();
  return (namespaceName: string, signal: AbortSignal) => {
    let load = loads.get(namespaceName);
    if (!load) {
      load = loadNamespace(client, namespaceName, signal);
      loads.set(namespaceName, load);
      load.catch(() => loads.delete(namespaceName));
    }
    return load;
  };
}

type ComponentList<T> = (
  namespaceName: string,
  componentName: string,
  signal: AbortSignal,
) => Promise<T[]>;

/**
 * A component's lists for one run, read once and shared by its main line and
 * its release lines. Failed loads aren't kept, as with namespace contexts.
 */
function componentListLoader<T>(list: ComponentList<T>): ComponentList<T> {
  const loads = new Map<string, Promise<T[]>>();
  return (namespaceName, componentName, signal) => {
    const key = `${namespaceName}/${componentName}`;
    let load = loads.get(key);
    if (!load) {
      load = list(namespaceName, componentName, signal);
      loads.set(key, load);
      load.catch(() => loads.delete(key));
    }
    return load;
  };
}

/**
 * The Workloads of every line of a component. The API has no filter by
 * line, so a line's Workload is the one it owns.
 */
function listWorkloads(
  client: OpenChoreoApiClient,
): ComponentList<WorkloadSpec> {
  return async (namespaceName, componentName, signal) => {
    const workloads = await fetchAllPages(cursor =>
      client
        .GET('/api/v1/namespaces/{namespaceName}/workloads', {
          params: {
            path: { namespaceName },
            query: { component: componentName, cursor },
          },
          signal,
        })
        .then(({ data, response }) => {
          if (!data) {
            throw new Error(`GET workloads returned HTTP ${response.status}`);
          }
          return data;
        }),
    );
    return workloads.map(workload => (workload.spec ?? {}) as WorkloadSpec);
  };
}

/** The release bindings of every line of a component. */
function listReleaseBindings(
  client: OpenChoreoApiClient,
): ComponentList<ReleaseBinding> {
  return async (namespaceName, componentName, signal) =>
    (await fetchAllPages(cursor =>
      client
        .GET('/api/v1/namespaces/{namespaceName}/releasebindings', {
          params: {
            path: { namespaceName },
            query: { component: componentName, cursor },
          },
          signal,
        })
        .then(({ data, response }) => {
          if (!data) {
            throw new Error(
              `GET release bindings returned HTTP ${response.status}`,
            );
          }
          return data;
        }),
    )) as ReleaseBinding[];
}

const schema: FactRetriever['schema'] = {
  openchoreoComponentResolved: {
    type: 'boolean',
    description:
      'Whether the component was found in OpenChoreo. When false, every other fact is null. Components the OpenChoreo catalog provider did not create get no facts.',
  },
  openchoreoImageRegistry: {
    type: 'string',
    description:
      "Registry host of the container image, docker.io when the image names none. Left out until the line has a Workload, and for a release line when the portal service credentials can't view every Workload of its component.",
  },
  openchoreoImagePinned: {
    type: 'boolean',
    description:
      'Whether the image is pinned to a digest, or to a tag other than one that conventionally moves (latest, main, master, dev, develop, edge, nightly, stable, staging)',
  },
  openchoreoExternalEndpointCount: {
    type: 'integer',
    description: 'Endpoints exposed outside the data plane',
  },
  openchoreoPlainTextSecretEnvCount: {
    type: 'integer',
    description:
      'Environment variables whose name looks like a secret (token, password, API key…) but hold a plain value instead of a secret reference, in the Workload or in the per-environment overrides of its release bindings',
  },
  openchoreoDeployedEnvironments: {
    type: 'set',
    description:
      'Environments where an active release binding has synced its release to the data plane. Reported only when the portal service credentials can read every binding of the component and every environment in its namespace.',
  },
  openchoreoDeployedToProduction: {
    type: 'boolean',
    description:
      'Whether the component is deployed to an environment marked as production',
  },
  openchoreoReadyInAllEnvironments: {
    type: 'boolean',
    description:
      'Whether the component is deployed and ready in every environment it is bound to',
  },
  openchoreoRunsLatestRelease: {
    type: 'boolean',
    description:
      "Whether every environment is bound to the line's latest release, the main line's for a component. Readiness is reported separately by openchoreoReadyInAllEnvironments. Left out when OpenChoreo records no latest release, which it does only with autoDeploy on.",
  },
};

const UNRESOLVED_FACTS = unresolvedFacts(schema, 'openchoreoComponentResolved');

export function createOpenChoreoDeploymentFactRetriever(
  tokenService: OpenChoreoTokenService,
): FactRetriever {
  return {
    id: OPENCHOREO_DEPLOYMENT_FACT_RETRIEVER_ID,
    version: '0.2.0',
    title: 'OpenChoreo Deployment',
    description:
      "What an OpenChoreo component's main line or a release line runs and where it's deployed, read from the line's Workload and release bindings.",
    entityFilter: [{ kind: 'component' }, { kind: 'releaseline' }],
    schema,
    handler: context =>
      collectOpenChoreoFacts(
        context,
        async () => {
          const client = await createServiceClient(context, tokenService);
          return {
            client,
            namespaceOf: namespaceLoader(client),
            workloadsOf: componentListLoader(listWorkloads(client)),
            bindingsOf: componentListLoader(listReleaseBindings(client)),
          };
        },
        async (
          entity,
          { client, namespaceOf, workloadsOf, bindingsOf },
          signal,
        ) => {
          const annotations = entity.metadata.annotations ?? {};
          const namespaceName = annotations[CHOREO_ANNOTATIONS.NAMESPACE];
          const projectName = annotations[CHOREO_ANNOTATIONS.PROJECT];
          const componentName = annotations[CHOREO_ANNOTATIONS.COMPONENT];
          const workloadName = annotations[CHOREO_ANNOTATIONS.WORKLOAD];
          const releaseLine = isReleaseLine(entity)
            ? annotations[CHOREO_ANNOTATIONS.RELEASE_LINE]
            : undefined;
          // Not an OpenChoreo component or release line, so not this
          // retriever's to judge.
          if (!componentName || (isReleaseLine(entity) && !releaseLine)) {
            return undefined;
          }
          if (!namespaceName) {
            return UNRESOLVED_FACTS;
          }
          const subject = releaseLine
            ? `${componentName}:${releaseLine}`
            : componentName;

          // A failed load is held as its error and reported with the
          // deployment facts, so a main line keeps its Workload facts.
          const namespace = await namespaceOf(namespaceName, signal).catch(
            (error: Error) => error,
          );
          const grants = (action: string) =>
            !(namespace instanceof Error) &&
            !!projectName &&
            grantsUnconditionally(
              namespace.capabilities,
              action,
              componentPath(namespaceName, projectName, componentName),
            );

          const facts: Record<string, string | number | boolean | string[]> = {
            openchoreoComponentResolved: true,
          };
          // A line that has never been built has no Workload yet. It still
          // resolves, so its deployment facts show it deployed nowhere.
          let workload: WorkloadSpec | undefined;
          if (releaseLine) {
            // The list leaves out Workloads the caller can't view, and the
            // check can depend on the line, so a line's Workload missing
            // from it means unbuilt only under a grant without conditions.
            if (grants('workload:view')) {
              workload = (
                await workloadsOf(namespaceName, componentName, signal)
              ).find(spec => spec.owner?.releaseLine === releaseLine);
            }
          } else if (workloadName) {
            const workloadResponse = await client.GET(
              '/api/v1/namespaces/{namespaceName}/workloads/{workloadName}',
              { params: { path: { namespaceName, workloadName } }, signal },
            );
            if (workloadResponse.response.status === 404) {
              return UNRESOLVED_FACTS;
            }
            if (!workloadResponse.data) {
              throw new Error(
                `GET workload ${workloadName} returned HTTP ${workloadResponse.response.status}`,
              );
            }
            workload = (workloadResponse.data.spec ?? {}) as WorkloadSpec;
          }
          let workloadEnv: EnvVar[] | undefined;
          if (workload) {
            workloadEnv = workload.container?.env ?? [];
            Object.assign(facts, workloadFacts(workload));
          }

          const withoutDeployment = (reason: string) => {
            context.logger.warn(
              `Leaving out deployment facts for ${subject}: ${reason}`,
            );
            return facts;
          };

          // Binding facts are left out rather than guessed when they can't
          // be read in full: a list the caller can't see all of comes back
          // as 200 with only the visible items, so an undeployed component
          // would look the same as an unreadable one.
          if (namespace instanceof Error) {
            return withoutDeployment(namespace.message);
          }
          const { productionEnvironments } = namespace;
          if (!productionEnvironments || !grants('releasebinding:view')) {
            return facts;
          }

          // The component's latest release is its main line's.
          const line = releaseLine
            ? await client.GET(
                '/api/v1/namespaces/{namespaceName}/components/{componentName}/releaselines/{releaseLineName}',
                {
                  params: {
                    path: {
                      namespaceName,
                      componentName,
                      releaseLineName: releaseLine,
                    },
                  },
                  signal,
                },
              )
            : await client.GET(
                '/api/v1/namespaces/{namespaceName}/components/{componentName}',
                { params: { path: { namespaceName, componentName } }, signal },
              );
          if (!line.data) {
            return withoutDeployment(
              `GET ${
                releaseLine ? 'release line' : 'component'
              } returned HTTP ${line.response.status}`,
            );
          }
          let bindings: ReleaseBinding[];
          try {
            bindings = lineBindings(
              await bindingsOf(namespaceName, componentName, signal),
              releaseLine,
            );
          } catch (error) {
            return withoutDeployment((error as Error).message);
          }

          return {
            ...facts,
            // Overrides set per environment are what the component runs, so
            // they count along with the Workload's own values.
            ...(workloadEnv && {
              openchoreoPlainTextSecretEnvCount: plainTextSecretEnvCount([
                workloadEnv,
                ...activeBindings(bindings).map(
                  binding =>
                    binding.spec?.workloadOverrides?.container?.env ?? [],
                ),
              ]),
            }),
            ...releaseBindingFacts({
              bindings,
              productionEnvironments,
              latestRelease: line.data.status?.latestRelease?.name,
            }),
          };
        },
      ),
  };
}
