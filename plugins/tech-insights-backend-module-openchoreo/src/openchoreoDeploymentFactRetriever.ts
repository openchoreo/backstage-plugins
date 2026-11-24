import type { LoggerService } from '@backstage/backend-plugin-api';
import type {
  FactRetriever,
  TechInsightFact,
} from '@backstage-community/plugin-tech-insights-node';
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
  mayGrant,
  namespacePath,
  projectPath,
  type ActionCapability,
} from './capabilities';
import {
  activeBindings,
  endpointsPerEnvironment,
  environmentDeployment,
  isObserveBinding,
  lineBindings,
  lineExternalEndpoints,
  type Endpoint,
  type EndpointReleaseBinding,
  type ReleaseBinding,
  type ReleasedWorkload,
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

type ScopedList<T> = (
  namespaceName: string,
  name: string,
  signal: AbortSignal,
) => Promise<T[]>;

/**
 * Loads for one run, kept by key. Failed loads aren't kept, as with
 * namespace contexts.
 */
function runCache<T>() {
  const loads = new Map<string, Promise<T>>();
  return (key: string, load: () => Promise<T>): Promise<T> => {
    let cached = loads.get(key);
    if (!cached) {
      cached = load();
      loads.set(key, cached);
      cached.catch(() => loads.delete(key));
    }
    return cached;
  };
}

/**
 * Lists for one run, read once per namespace and name: a component's, shared
 * by its main line and its release lines, or a project's, shared by its
 * components.
 */
function listLoader<T>(list: ScopedList<T>): ScopedList<T> {
  const cache = runCache<T[]>();
  return (namespaceName, name, signal) =>
    cache(`${namespaceName}/${name}`, () => list(namespaceName, name, signal));
}

/** The release bindings of every line of a component. */
function listReleaseBindings(
  client: OpenChoreoApiClient,
): ScopedList<ReleaseBinding> {
  return async (namespaceName, componentName, signal) => {
    const bindings = await fetchAllPages(cursor =>
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
    );
    return bindings as ReleaseBinding[];
  };
}

/**
 * The Endpoints of a project. The API has no filter by component, so a
 * line's Endpoints are the ones it owns.
 */
function listProjectEndpoints(
  client: OpenChoreoApiClient,
): ScopedList<Endpoint> {
  return async (namespaceName, projectName, signal) =>
    fetchAllPages(cursor =>
      client
        .GET('/api/v1/namespaces/{namespaceName}/endpoints', {
          params: {
            path: { namespaceName },
            query: { project: projectName, cursor },
          },
          signal,
        })
        .then(({ data, response }) => {
          if (!data) {
            throw new Error(`GET endpoints returned HTTP ${response.status}`);
          }
          return data;
        }),
    );
}

/**
 * The Endpoint release bindings of a namespace, read once per run. The API
 * filters them by Endpoint only, and scans the namespace for each such
 * request, so one list serves every Endpoint.
 */
function endpointBindingsLoader(client: OpenChoreoApiClient) {
  const cache = runCache<EndpointReleaseBinding[]>();
  return (namespaceName: string, signal: AbortSignal) =>
    cache(namespaceName, () =>
      fetchAllPages(cursor =>
        client
          .GET('/api/v1/namespaces/{namespaceName}/endpointreleasebindings', {
            params: { path: { namespaceName }, query: { cursor } },
            signal,
          })
          .then(({ data, response }) => {
            if (!data) {
              throw new Error(
                `GET endpoint release bindings returned HTTP ${response.status}`,
              );
            }
            return data;
          }),
      ),
    );
}

/** Logs a warning the first time it's called in a run, with `detail`. */
function warnOnce(logger: LoggerService, message: string) {
  let warned = false;
  return (detail: string) => {
    if (!warned) {
      warned = true;
      logger.warn(`${message} (${detail})`);
    }
  };
}

type ReleaseReader = (
  namespaceName: string,
  releaseName: string,
  signal: AbortSignal,
) => Promise<ReleasedWorkload | undefined>;

/**
 * The Workload each ComponentRelease froze, read once per run since releases
 * are immutable and bindings on the same release share it. Resolves to
 * undefined when the release can't be read, so only the fields it feeds are
 * left out. A 403 is kept for the run and reported through `forbidden`,
 * since it means the service credentials lack the grant rather than that one
 * release is unusual. A 404 is kept too; other failures aren't, so a later
 * entity tries again.
 */
function componentReleaseLoader(
  client: OpenChoreoApiClient,
  logger: LoggerService,
  forbidden: (detail: string) => void,
): ReleaseReader {
  const loads = new Map<string, Promise<ReleasedWorkload | undefined>>();
  return (namespaceName, releaseName, signal) => {
    const key = `${namespaceName}/${releaseName}`;
    let load = loads.get(key);
    if (!load) {
      load = client
        .GET(
          '/api/v1/namespaces/{namespaceName}/componentreleases/{componentReleaseName}',
          {
            params: {
              path: { namespaceName, componentReleaseName: releaseName },
            },
            signal,
          },
        )
        .then(({ data, response }) => {
          if (data) {
            return (data.spec?.workload ?? {}) as ReleasedWorkload;
          }
          if (response.status === 403) {
            forbidden(
              `GET component release ${releaseName} in ${namespaceName} returned HTTP 403`,
            );
            return undefined;
          }
          if (response.status === 404) {
            logger.warn(
              `Leaving out the image and secret fields of the bindings on ${namespaceName}/${releaseName}: the ComponentRelease doesn't exist`,
            );
            return undefined;
          }
          throw new Error(
            `GET component release ${releaseName} returned HTTP ${response.status}`,
          );
        });
      loads.set(key, load);
      load.catch(() => loads.delete(key));
    }
    return load.catch((error: Error) => {
      logger.warn(
        `Leaving out the image and secret fields of the bindings on ${namespaceName}/${releaseName}: ${error.message}`,
      );
      return undefined;
    });
  };
}

const ENVIRONMENT_DEPLOYMENT_ENTRIES = {
  environment: { type: 'string', description: 'Environment name' },
  isProduction: {
    type: 'boolean',
    description: 'Whether the environment is marked as production',
  },
  isReleaseSynced: {
    type: 'boolean',
    description:
      'Whether the release has synced to the data plane (ReleaseSynced). A release that is missing, fails to render or has nowhere to go never syncs.',
  },
  isReady: {
    type: 'boolean',
    description: 'Whether the binding reports Ready',
  },
  isOnLatestRelease: {
    type: 'boolean',
    description:
      "Whether the binding is on the line's latest release, regardless of readiness. Left out when OpenChoreo records no latest release, which it does only with autoDeploy on, and for Observe bindings.",
  },
  plainTextSecretEnvVarCount: {
    type: 'integer',
    description:
      "Environment variables whose name looks like a secret (token, password, API key…) but hold a plain value instead of a secret reference, in the Workload the binding's ComponentRelease froze and the binding's own overrides. Left out for Observe bindings, and when the ComponentRelease can't be read, which needs componentrelease:view.",
  },
  isImagePinned: {
    type: 'boolean',
    description:
      "Whether the container image of the binding's ComponentRelease is pinned to a digest, or to a tag other than one that conventionally moves (latest, main, master, dev, develop, edge, nightly, stable, staging). Left out as plainTextSecretEnvVarCount is.",
  },
  imageRegistry: {
    type: 'string',
    description:
      "Registry host of the container image of the binding's ComponentRelease, docker.io when the image names none. Left out as plainTextSecretEnvVarCount is.",
  },
  externalEndpointCount: {
    type: 'integer',
    description:
      "Endpoints the line owns with external visibility that have an EndpointReleaseBinding in the environment. Left out when the portal service credentials can't view every Endpoint and EndpointReleaseBinding in the project.",
  },
};

const schema: FactRetriever['schema'] = {
  openchoreoComponentResolved: {
    type: 'boolean',
    description:
      'Whether the component was found in OpenChoreo. When false, every other fact is null. Components the OpenChoreo catalog provider did not create get no facts.',
  },
  openchoreoEnvironmentDeployments: {
    type: 'set',
    description:
      "One entry per active release binding of the line, the main line's for a component, describing the environment and what runs there. Select entries with a condition's path and the everyFact: or someFact: operators, e.g. path $[?(@.isProduction)].isReady with everyFact:equal true. Reported only when the portal service credentials can read every binding of the component and every environment in its namespace, and left out for a line with no active binding, so its checks show no result. A field whose source can't be read is left out of its entry. A binding the OpenChoreo API reports in Observe mode renders nothing from its release, so its entry leaves out isOnLatestRelease, plainTextSecretEnvVarCount, isImagePinned and imageRegistry.",
    metadata: { entries: ENVIRONMENT_DEPLOYMENT_ENTRIES },
  },
};

const UNRESOLVED_FACTS = unresolvedFacts(schema, 'openchoreoComponentResolved');

export function createOpenChoreoDeploymentFactRetriever(
  tokenService: OpenChoreoTokenService,
): FactRetriever {
  return {
    id: OPENCHOREO_DEPLOYMENT_FACT_RETRIEVER_ID,
    version: '0.3.0',
    title: 'OpenChoreo Deployment',
    description:
      "Where an OpenChoreo component's main line or a release line is deployed and what each environment runs, read from the line's release bindings, their ComponentReleases and the line's Endpoints.",
    entityFilter: [{ kind: 'component' }, { kind: 'releaseline' }],
    schema,
    handler: context =>
      collectOpenChoreoFacts(
        context,
        async () => {
          const client = await createServiceClient(context, tokenService);
          const releaseNotGranted = warnOnce(
            context.logger,
            'Leaving out the image and secret fields of openchoreoEnvironmentDeployments: the portal service credentials need componentrelease:view',
          );
          return {
            client,
            namespaceOf: namespaceLoader(client),
            bindingsOf: listLoader(listReleaseBindings(client)),
            endpointsOf: listLoader(listProjectEndpoints(client)),
            endpointBindingsOf: endpointBindingsLoader(client),
            releaseOf: componentReleaseLoader(
              client,
              context.logger,
              releaseNotGranted,
            ),
            releaseNotGranted,
          };
        },
        async (
          entity,
          {
            client,
            namespaceOf,
            bindingsOf,
            endpointsOf,
            endpointBindingsOf,
            releaseOf,
            releaseNotGranted,
          },
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

          // The Workload a component names is how a deleted component is
          // told apart from one that is only undeployed. A component that has
          // never been built names none, and still resolves.
          if (!releaseLine && workloadName) {
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
          }

          const facts: TechInsightFact['facts'] = {
            openchoreoComponentResolved: true,
          };
          const withoutDeployment = (reason: string) => {
            context.logger.warn(
              `Leaving out deployment facts for ${subject}: ${reason}`,
            );
            return facts;
          };

          const namespace = await namespaceOf(namespaceName, signal).catch(
            (error: Error) => error,
          );
          // Binding facts are left out rather than guessed when they can't
          // be read in full: a list the caller can't see all of comes back
          // as 200 with only the visible items, so an undeployed component
          // would look the same as an unreadable one.
          if (namespace instanceof Error) {
            return withoutDeployment(namespace.message);
          }
          const { capabilities, productionEnvironments } = namespace;
          if (
            !projectName ||
            !productionEnvironments ||
            !grantsUnconditionally(
              capabilities,
              'releasebinding:view',
              componentPath(namespaceName, projectName, componentName),
            )
          ) {
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
            bindings = activeBindings(
              lineBindings(
                await bindingsOf(namespaceName, componentName, signal),
                releaseLine,
              ),
            );
          } catch (error) {
            return withoutDeployment((error as Error).message);
          }
          // jsonfc skips a check when a fact it uses is missing, but
          // everyFact fails on an empty list, so a line deployed nowhere gets
          // no result rather than failing every environment check.
          if (bindings.length === 0) {
            return facts;
          }

          // A grant under CEL constraints may still allow the read, so only a
          // profile that can't grant it skips the requests.
          const component = componentPath(
            namespaceName,
            projectName,
            componentName,
          );
          const mayReadReleases = mayGrant(
            capabilities,
            'componentrelease:view',
            component,
          );
          if (!mayReadReleases) {
            releaseNotGranted(
              `the authz profile doesn't grant it on ${component}`,
            );
          }
          const releases = new Map<string, ReleasedWorkload | undefined>();
          for (const binding of bindings) {
            const releaseName = binding.spec!.releaseName;
            if (
              mayReadReleases &&
              releaseName &&
              !isObserveBinding(binding) &&
              !releases.has(releaseName)
            ) {
              releases.set(
                releaseName,
                await releaseOf(namespaceName, releaseName, signal),
              );
            }
          }

          // Endpoints and their bindings are authorized per project, and a
          // list comes back with only the items the caller may see, so a
          // narrower grant would count hidden Endpoints as none.
          let externalEndpoints: Map<string, number> | undefined;
          const project = projectPath(namespaceName, projectName);
          if (
            grantsUnconditionally(capabilities, 'endpoint:view', project) &&
            grantsUnconditionally(
              capabilities,
              'endpointreleasebinding:view',
              project,
            )
          ) {
            try {
              const owned = lineExternalEndpoints(
                await endpointsOf(namespaceName, projectName, signal),
                componentName,
                releaseLine,
              );
              externalEndpoints =
                owned.length === 0
                  ? new Map()
                  : endpointsPerEnvironment(
                      projectName,
                      owned.map(endpoint => endpoint.metadata.name),
                      await endpointBindingsOf(namespaceName, signal),
                    );
            } catch (error) {
              context.logger.warn(
                `Leaving out external endpoint counts for ${subject}: ${
                  (error as Error).message
                }`,
              );
            }
          }

          const latestRelease = line.data.status?.latestRelease?.name;
          return {
            ...facts,
            openchoreoEnvironmentDeployments: bindings.map(binding =>
              environmentDeployment({
                binding,
                productionEnvironments,
                latestRelease,
                release: binding.spec!.releaseName
                  ? releases.get(binding.spec!.releaseName)
                  : undefined,
                externalEndpoints,
              }),
            ),
          };
        },
      ),
  };
}
