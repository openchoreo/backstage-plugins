import type { FactRetriever } from '@backstage-community/plugin-tech-insights-node';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import type { OpenChoreoTokenService } from '@openchoreo/openchoreo-auth';
import {
  collectOpenChoreoFacts,
  createServiceClient,
  isReleaseLine,
  type OpenChoreoApiClient,
} from './collectOpenChoreoFacts';
import { buildFacts, type WorkflowRun } from './buildFacts';

export const OPENCHOREO_BUILD_FACT_RETRIEVER_ID =
  'openchoreoBuildFactRetriever';

const PAGE_SIZE = 100;

/** Components with more retained runs than this get no build facts. */
export const MAX_RUN_PAGES = 5;

/**
 * Every retained run of `releaseLine`, or of the component's main line when
 * it's undefined. OpenChoreo labels a run with its line only when one is
 * named, so main-line runs are the ones without the label. Undefined when
 * there are more than `MAX_RUN_PAGES` pages of them.
 */
async function listRuns(
  client: OpenChoreoApiClient,
  namespaceName: string,
  projectName: string,
  componentName: string,
  releaseLine: string | undefined,
  signal: AbortSignal,
): Promise<WorkflowRun[] | undefined> {
  const line = releaseLine
    ? `openchoreo.dev/release-line=${releaseLine}`
    : '!openchoreo.dev/release-line';
  const runs: WorkflowRun[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_RUN_PAGES; page++) {
    const { data, response } = await client.GET(
      '/api/v1/namespaces/{namespaceName}/workflowruns',
      {
        params: {
          path: { namespaceName },
          query: {
            labelSelector: `openchoreo.dev/project=${projectName},openchoreo.dev/component=${componentName},${line}`,
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
      'Whether the newest finished build succeeded. Left out when no finished build is retained.',
  },
  openchoreoBuildSuccessRate: {
    type: 'float',
    description:
      'Share of the newest 20 finished builds that succeeded, from 0 to 1. Left out when no finished build is retained.',
  },
};

export function createOpenChoreoBuildFactRetriever(
  tokenService: OpenChoreoTokenService,
): FactRetriever {
  return {
    id: OPENCHOREO_BUILD_FACT_RETRIEVER_ID,
    version: '0.2.0',
    title: 'OpenChoreo Build',
    description:
      "How the builds of an OpenChoreo component's main line or of a release line went, read from the line's workflow runs.",
    entityFilter: [{ kind: 'component' }, { kind: 'releaseline' }],
    schema,
    handler: context =>
      collectOpenChoreoFacts(
        context,
        () => createServiceClient(context, tokenService),
        async (entity, client, signal) => {
          const annotations = entity.metadata.annotations ?? {};
          const namespaceName = annotations[CHOREO_ANNOTATIONS.NAMESPACE];
          const projectName = annotations[CHOREO_ANNOTATIONS.PROJECT];
          const componentName = annotations[CHOREO_ANNOTATIONS.COMPONENT];
          const releaseLine = isReleaseLine(entity)
            ? annotations[CHOREO_ANNOTATIONS.RELEASE_LINE]
            : undefined;
          // Not an OpenChoreo component or release line, so not this
          // retriever's to judge.
          if (!componentName || (isReleaseLine(entity) && !releaseLine)) {
            return undefined;
          }
          if (!namespaceName || !projectName) {
            return {};
          }

          const runs = await listRuns(
            client,
            namespaceName,
            projectName,
            componentName,
            releaseLine,
            signal,
          );
          if (!runs) {
            context.logger.warn(
              `Leaving out build facts for ${
                releaseLine ? `${componentName}:${releaseLine}` : componentName
              }: more than ${
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
