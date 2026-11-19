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

/**
 * The Workload of a release line. The API lists a component's Workloads on
 * every line, so the line's is the one it owns. Undefined when the line has
 * no Workload yet.
 */
async function lineWorkload(
  client: OpenChoreoApiClient,
  namespaceName: string,
  componentName: string,
  releaseLine: string,
  signal: AbortSignal,
): Promise<WorkloadSpec | undefined> {
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
  return workloads
    .map(workload => (workload.spec ?? {}) as WorkloadSpec)
    .find(spec => spec.owner?.releaseLine === releaseLine);
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
      'Registry host of the container image, docker.io when the image names none. Left out until the component has a Workload.',
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
          return { client, namespaceOf: namespaceLoader(client) };
        },
        async (entity, { client, namespaceOf }, signal) => {
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

          const facts: Record<string, string | number | boolean | string[]> = {
            openchoreoComponentResolved: true,
          };
          // A line that has never been built has no Workload yet. It still
          // resolves, so its deployment facts show it deployed nowhere.
          let workload: WorkloadSpec | undefined;
          if (releaseLine) {
            workload = await lineWorkload(
              client,
              namespaceName,
              componentName,
              releaseLine,
              signal,
            );
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
          let namespace: NamespaceContext;
          try {
            namespace = await namespaceOf(namespaceName, signal);
          } catch (error) {
            return withoutDeployment((error as Error).message);
          }
          const { capabilities, productionEnvironments } = namespace;
          if (
            !productionEnvironments ||
            !projectName ||
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
            const all = (await fetchAllPages(cursor =>
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
            bindings = lineBindings(all, releaseLine);
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
