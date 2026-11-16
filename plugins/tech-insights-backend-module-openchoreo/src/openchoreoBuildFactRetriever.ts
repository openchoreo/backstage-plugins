import type { FactRetriever } from '@backstage-community/plugin-tech-insights-node';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import type { OpenChoreoTokenService } from '@openchoreo/openchoreo-auth';
import {
  collectOpenChoreoFacts,
  createServiceClient,
  type OpenChoreoApiClient,
} from './collectOpenChoreoFacts';
import {
  componentPath,
  grantsUnconditionally,
  type ActionCapability,
} from './capabilities';
import { buildFacts, type WorkflowRun } from './buildFacts';

export const OPENCHOREO_BUILD_FACT_RETRIEVER_ID =
  'openchoreoBuildFactRetriever';

const PAGE_SIZE = 100;

/** Components with more retained runs than this get no build facts. */
export const MAX_RUN_PAGES = 5;

/**
 * Authz profiles for one run, one per namespace. A failed load isn't kept,
 * so the next entity in the namespace loads it again.
 */
function profileLoader(client: OpenChoreoApiClient) {
  const loads = new Map<string, Promise<Record<string, ActionCapability>>>();
  return (namespaceName: string, signal: AbortSignal) => {
    let load = loads.get(namespaceName);
    if (!load) {
      load = client
        .GET('/api/v1/authz/profile', {
          params: { query: { namespace: namespaceName } },
          signal,
        })
        .then(({ data, response }) => {
          if (!data) {
            throw new Error(
              `GET authz profile for namespace ${namespaceName} returned HTTP ${response.status}`,
            );
          }
          return (data.capabilities ?? {}) as Record<string, ActionCapability>;
        });
      loads.set(namespaceName, load);
      load.catch(() => loads.delete(namespaceName));
    }
    return load;
  };
}

/**
 * Every retained run of a component, on any release line. Undefined when
 * there are more than `MAX_RUN_PAGES` pages of them.
 */
async function listRuns(
  client: OpenChoreoApiClient,
  namespaceName: string,
  projectName: string,
  componentName: string,
  signal: AbortSignal,
): Promise<WorkflowRun[] | undefined> {
  const runs: WorkflowRun[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_RUN_PAGES; page++) {
    const { data, response } = await client.GET(
      '/api/v1/namespaces/{namespaceName}/workflowruns',
      {
        params: {
          path: { namespaceName },
          query: {
            labelSelector: `openchoreo.dev/project=${projectName},openchoreo.dev/component=${componentName}`,
            limit: PAGE_SIZE,
            cursor,
          },
        },
        signal,
      },
    );
    if (!data) {
      throw new Error(`GET workflow runs returned HTTP ${response.status}`);
    }
    runs.push(...(data.items as WorkflowRun[]));
    cursor = data.pagination?.nextCursor;
    if (!cursor) {
      return runs;
    }
  }
  return undefined;
}

const schema: FactRetriever['schema'] = {
  openchoreoBuildLastSucceeded: {
    type: 'boolean',
    description:
      'Whether the newest finished build succeeded. Left out when no finished build is retained, or when the portal service credentials cannot read every build of the component.',
  },
  openchoreoBuildSuccessRate: {
    type: 'float',
    description:
      'Share of the newest 20 finished builds that succeeded, from 0 to 1. Left out when no finished build is retained, or when the portal service credentials cannot read every build of the component.',
  },
};

export function createOpenChoreoBuildFactRetriever(
  tokenService: OpenChoreoTokenService,
): FactRetriever {
  return {
    id: OPENCHOREO_BUILD_FACT_RETRIEVER_ID,
    version: '0.1.0',
    title: 'OpenChoreo Build',
    description:
      "How an OpenChoreo component's builds went, read from its workflow runs on every release line.",
    entityFilter: [{ kind: 'component' }],
    schema,
    handler: context =>
      collectOpenChoreoFacts(
        context,
        async () => {
          const client = await createServiceClient(context, tokenService);
          return { client, profileOf: profileLoader(client) };
        },
        async (entity, { client, profileOf }, signal) => {
          const annotations = entity.metadata.annotations ?? {};
          const namespaceName = annotations[CHOREO_ANNOTATIONS.NAMESPACE];
          const projectName = annotations[CHOREO_ANNOTATIONS.PROJECT];
          const componentName = annotations[CHOREO_ANNOTATIONS.COMPONENT];
          // Not an OpenChoreo component, so not this retriever's to judge.
          if (!componentName) {
            return undefined;
          }
          if (!namespaceName || !projectName) {
            return {};
          }

          // A run list the caller can only partly see comes back as 200 with
          // the visible runs, so a component would look unbuilt. Facts are
          // reported only when every run can be read.
          const capabilities = await profileOf(namespaceName, signal);
          if (
            !grantsUnconditionally(
              capabilities,
              'workflowrun:view',
              componentPath(namespaceName, projectName, componentName),
            )
          ) {
            return {};
          }

          const runs = await listRuns(
            client,
            namespaceName,
            projectName,
            componentName,
            signal,
          );
          if (!runs) {
            context.logger.warn(
              `Leaving out build facts for ${componentName}: more than ${
                MAX_RUN_PAGES * PAGE_SIZE
              } workflow runs are retained`,
            );
            return {};
          }
          return buildFacts(runs);
        },
      ),
  };
}
