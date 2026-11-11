import type { FactRetriever } from '@backstage-community/plugin-tech-insights-node';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import type { OpenChoreoTokenService } from '@openchoreo/openchoreo-auth';
import { fetchAllPages } from '@openchoreo/openchoreo-client-node';
import {
  collectOpenChoreoFacts,
  createServiceClient,
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
      'Environments with an active release binding. Reported only when the portal service credentials can read every binding of the component and every environment in its namespace.',
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
      "Whether every environment runs the component's latest release. Left out when OpenChoreo records no latest release, which it does only for components with autoDeploy on.",
  },
};

const UNRESOLVED_FACTS = unresolvedFacts(schema, 'openchoreoComponentResolved');

export function createOpenChoreoDeploymentFactRetriever(
  tokenService: OpenChoreoTokenService,
): FactRetriever {
  return {
    id: OPENCHOREO_DEPLOYMENT_FACT_RETRIEVER_ID,
    version: '0.1.0',
    title: 'OpenChoreo Deployment',
    description:
      "What an OpenChoreo component runs and where it's deployed, read from its Workload and release bindings.",
    entityFilter: [{ kind: 'component' }],
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
          // Not an OpenChoreo component, so not this retriever's to judge.
          if (!componentName) {
            return undefined;
          }
          if (!namespaceName) {
            return UNRESOLVED_FACTS;
          }

          const facts: Record<string, string | number | boolean | string[]> = {
            openchoreoComponentResolved: true,
          };
          // A component that has never been built has no Workload yet. It
          // still resolves, so its deployment facts show it deployed nowhere.
          let workloadEnv: EnvVar[] | undefined;
          if (workloadName) {
            const workload = await client.GET(
              '/api/v1/namespaces/{namespaceName}/workloads/{workloadName}',
              { params: { path: { namespaceName, workloadName } }, signal },
            );
            if (workload.response.status === 404) {
              return UNRESOLVED_FACTS;
            }
            if (!workload.data) {
              throw new Error(
                `GET workload ${workloadName} returned HTTP ${workload.response.status}`,
              );
            }
            const spec = (workload.data.spec ?? {}) as WorkloadSpec;
            workloadEnv = spec.container?.env ?? [];
            Object.assign(facts, workloadFacts(spec));
          }

          const withoutDeployment = (reason: string) => {
            context.logger.warn(
              `Leaving out deployment facts for ${componentName}: ${reason}`,
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

          const component = await client.GET(
            '/api/v1/namespaces/{namespaceName}/components/{componentName}',
            { params: { path: { namespaceName, componentName } }, signal },
          );
          if (!component.data) {
            return withoutDeployment(
              `GET component returned HTTP ${component.response.status}`,
            );
          }
          let bindings: ReleaseBinding[];
          try {
            bindings = (await fetchAllPages(cursor =>
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
              latestRelease: component.data.status?.latestRelease?.name,
            }),
          };
        },
      ),
  };
}
