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
  type ActionCapability,
} from './capabilities';
import {
  releaseBindingFacts,
  workloadFacts,
  type ReleaseBinding,
  type WorkloadSpec,
} from './deploymentFacts';

export const OPENCHOREO_DEPLOYMENT_FACT_RETRIEVER_ID =
  'openchoreoDeploymentFactRetriever';

interface NamespaceContext {
  capabilities: Record<string, ActionCapability>;
  productionEnvironments: Set<string>;
}

/** Reads the authz profile and production environments of a namespace. */
async function loadNamespace(
  client: OpenChoreoApiClient,
  namespaceName: string,
): Promise<NamespaceContext> {
  const profile = await client.GET('/api/v1/authz/profile', {
    params: { query: { namespace: namespaceName } },
  });
  if (!profile.data) {
    throw new Error(
      `GET authz profile for namespace ${namespaceName} returned HTTP ${profile.response.status}`,
    );
  }

  const environments = await fetchAllPages(cursor =>
    client
      .GET('/api/v1/namespaces/{namespaceName}/environments', {
        params: { path: { namespaceName }, query: { cursor } },
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
    capabilities: (profile.data.capabilities ?? {}) as Record<
      string,
      ActionCapability
    >,
    productionEnvironments: new Set(
      environments
        .filter(environment => environment.spec?.isProduction)
        .map(environment => environment.metadata.name),
    ),
  };
}

/**
 * Namespace contexts for one run. A failed load isn't kept, so one
 * transient error costs only the entity that hit it.
 */
function namespaceLoader(client: OpenChoreoApiClient) {
  const loads = new Map<string, Promise<NamespaceContext>>();
  return (namespaceName: string) => {
    let load = loads.get(namespaceName);
    if (!load) {
      load = loadNamespace(client, namespaceName);
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
      'Whether the component and its Workload were found in OpenChoreo. When false, every other fact is null.',
  },
  openchoreoImageRegistry: {
    type: 'string',
    description:
      'Registry host of the container image, docker.io when the image names none',
  },
  openchoreoImagePinned: {
    type: 'boolean',
    description:
      'Whether the image is pinned to a digest or a tag other than latest',
  },
  openchoreoExternalEndpointCount: {
    type: 'integer',
    description: 'Endpoints exposed outside the data plane',
  },
  openchoreoPlainTextSecretEnvCount: {
    type: 'integer',
    description:
      'Environment variables whose name looks like a secret (token, password, key…) but hold a plain value instead of a secret reference',
  },
  openchoreoDeployedEnvironments: {
    type: 'set',
    description:
      'Environments with an active release binding. Reported only when the portal service credentials can read every binding of the component.',
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
      "Whether every environment runs the component's latest release",
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
        async (entity, { client, namespaceOf }) => {
          const annotations = entity.metadata.annotations ?? {};
          const namespaceName = annotations[CHOREO_ANNOTATIONS.NAMESPACE];
          const projectName = annotations[CHOREO_ANNOTATIONS.PROJECT];
          const componentName = annotations[CHOREO_ANNOTATIONS.COMPONENT];
          const workloadName = annotations[CHOREO_ANNOTATIONS.WORKLOAD];
          if (!namespaceName || !componentName || !workloadName) {
            return UNRESOLVED_FACTS;
          }

          const workload = await client.GET(
            '/api/v1/namespaces/{namespaceName}/workloads/{workloadName}',
            { params: { path: { namespaceName, workloadName } } },
          );
          if (workload.response.status === 404) {
            return UNRESOLVED_FACTS;
          }
          if (!workload.data) {
            throw new Error(
              `GET workload ${workloadName} returned HTTP ${workload.response.status}`,
            );
          }
          const facts: Record<string, string | number | boolean | string[]> =
            workloadFacts((workload.data.spec ?? {}) as WorkloadSpec);

          // Binding facts are left out rather than guessed when they can't
          // be read in full: a list the caller can't see all of comes back
          // as 200 with only the visible items, so an undeployed component
          // would look the same as an unreadable one.
          let namespace: NamespaceContext;
          try {
            namespace = await namespaceOf(namespaceName);
          } catch (error) {
            context.logger.warn(
              `Reporting only Workload facts for ${componentName}: ${
                (error as Error).message
              }`,
            );
            return facts;
          }
          if (
            !projectName ||
            !grantsUnconditionally(
              namespace.capabilities,
              'releasebinding:view',
              componentPath(namespaceName, projectName, componentName),
            )
          ) {
            return facts;
          }

          const component = await client.GET(
            '/api/v1/namespaces/{namespaceName}/components/{componentName}',
            { params: { path: { namespaceName, componentName } } },
          );
          if (!component.data) {
            throw new Error(
              `GET component ${componentName} returned HTTP ${component.response.status}`,
            );
          }
          const bindings = await fetchAllPages(cursor =>
            client
              .GET('/api/v1/namespaces/{namespaceName}/releasebindings', {
                params: {
                  path: { namespaceName },
                  query: { component: componentName, cursor },
                },
              })
              .then(({ data, response }) => {
                if (!data) {
                  throw new Error(
                    `GET release bindings of ${componentName} returned HTTP ${response.status}`,
                  );
                }
                return data;
              }),
          );

          return {
            ...facts,
            ...releaseBindingFacts({
              bindings: bindings as ReleaseBinding[],
              productionEnvironments: namespace.productionEnvironments,
              latestRelease: component.data.status?.latestRelease?.name,
            }),
          };
        },
      ),
  };
}
