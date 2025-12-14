import { IncrementalEntityProvider, EntityIteratorResult } from '../types';
import {
  createOpenChoreoApiClient,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';
import {
  DEFAULT_PAGE_LIMIT,
  fetchAllResources,
  type PaginationResult,
} from '@openchoreo/backstage-plugin-common';
import { Entity } from '@backstage/catalog-model';
import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import { EntityTranslator } from './entityTranslator';
import { ComponentBatchProcessor } from './componentBatchProcessor';

// Use generated types from OpenAPI spec
type ModelsOrganization =
  OpenChoreoComponents['schemas']['OrganizationResponse'];
type ModelsProject = OpenChoreoComponents['schemas']['ProjectResponse'];
type ModelsComponent = OpenChoreoComponents['schemas']['ComponentResponse'];
type ResponseMetadata = OpenChoreoComponents['schemas']['ResponseMetadata'];

/**
 * Incremental entity provider for OpenChoreo.
 * Processes entities in phases (organizations, projects, components) using cursor-based pagination
 * to enable efficient, resumable ingestion of large datasets.
 */

interface CursorTraversalCursor {
  orgApiCursor?: string;
  projectApiCursor?: string;
  componentApiCursor?: string;
  orgQueue: string[];
  currentOrgIndex: number;
  projectQueue: { org: string; project: string }[];
  currentProjectIndex: number;
  currentOrg?: string;
  currentProject?: string;
  cursorResetCount?: number;
  phase?: 'orgs' | 'projects' | 'components';
}

export type OpenChoreoCursor = CursorTraversalCursor;

// Context for API client and shared state
interface OpenChoreoContext {
  config: Config;
  logger: LoggerService;
}

/**
 * Incremental entity provider for OpenChoreo that processes entities in phases
 * using cursor-based pagination for efficient, resumable ingestion of large datasets.
 * Processes organizations, projects, and components in sequence with memory-efficient chunking.
 * Supports progressive traversal through large catalogs without requiring full data loading.
 */
export class OpenChoreoIncrementalEntityProvider
  implements IncrementalEntityProvider<OpenChoreoCursor, OpenChoreoContext>
{
  // OpenAPI schema caps page size at 500; enforce locally to avoid 400s
  private static readonly API_MAX_PAGE_LIMIT = 500;
  private readonly config: Config;
  private readonly logger: LoggerService;
  private readonly chunkSize: number;
  private readonly translator: EntityTranslator;
  private readonly batchProcessor: ComponentBatchProcessor;

  /**
   * Creates a new instance of the incremental entity provider
   * @param config - Backstage configuration for OpenChoreo settings
   * @param logger - Logger service for operational logging
   */
  constructor(config: Config, logger: LoggerService) {
    this.config = config;
    this.logger = logger;
    const configuredChunkSize =
      config.getOptionalNumber('openchoreo.incremental.chunkSize') ||
      DEFAULT_PAGE_LIMIT;
    this.chunkSize = Math.min(
      configuredChunkSize,
      OpenChoreoIncrementalEntityProvider.API_MAX_PAGE_LIMIT,
    );
    if (this.chunkSize < configuredChunkSize) {
      this.logger.debug(
        `Configured chunkSize ${configuredChunkSize} exceeds API max; capping to ${this.chunkSize}`,
      );
    }
    this.translator = new EntityTranslator(this.getProviderName());
    this.batchProcessor = new ComponentBatchProcessor(this.getProviderName());
  }

  getProviderName(): string {
    return 'OpenChoreoIncrementalEntityProvider';
  }

  /**
   * Sets up the provider context and detects pagination mode
   * Probes the API for cursor capability and falls back to legacy mode if unavailable
   * @param burst - Function to execute with the prepared context
   */
  async around(
    burst: (context: OpenChoreoContext) => Promise<void>,
  ): Promise<void> {
    const context: OpenChoreoContext = {
      config: this.config,
      logger: this.logger,
    };

    await burst(context);
  }

  /**
   * Processes the next batch of entities using cursor-based or legacy pagination
   * Routes to appropriate processing mode based on API capabilities
   * @param context - Provider context with config and logger
   * @param cursor - Current traversal state for resumable processing
   * @returns Iterator result with entities and next cursor state
   * @throws {Error} If entity processing fails unrecoverably
   */
  async next(
    context: OpenChoreoContext,
    cursor?: OpenChoreoCursor,
  ): Promise<EntityIteratorResult<OpenChoreoCursor>> {
    try {
      return await this.nextCursorMode(context, cursor);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Check if this is an expired cursor error (HTTP 410 Gone)
      if (
        errorMessage.includes('410') ||
        errorMessage.includes('expired') ||
        errorMessage.includes('continue parameter is too old')
      ) {
        const phase = cursor?.phase || 'unknown';
        const cursorValue = cursor?.orgApiCursor || cursor?.projectApiCursor || cursor?.componentApiCursor;
        
        context.logger.warn(
          `HTTP 410: Pagination token expired during '${phase}' phase. ` +
          `Cursor: ${cursorValue ? `${cursorValue.substring(0, 20)}...` : 'none'}. ` +
          `Resetting cursor and restarting ingestion from beginning.`
        );

        // Restart from the beginning without cursor
        return await this.nextCursorMode(context, undefined);
      }

      context.logger.error(`Error processing OpenChoreo entities: ${error}`);
      throw error;
    }
  }

  // ===================== Cursor Mode Implementation ===================== //

  /**
   * Core cursor-based processing routine that handles three-phase ingestion
   * Processes organizations, then projects, then components in sequence
   * Maintains traversal state across batches for resumable ingestion
   * @param context - Provider context with config and logger
   * @param cursor - Current cursor state for phase and position tracking
   * @returns Iterator result with entities and updated cursor state
   */
  private async nextCursorMode(
    context: OpenChoreoContext,
    cursor?: CursorTraversalCursor,
  ): Promise<EntityIteratorResult<CursorTraversalCursor>> {
    const baseUrl = this.config.getString('openchoreo.baseUrl');
    const client = createOpenChoreoApiClient({
      baseUrl,
      logger: context.logger,
    });

    // Initialize cursor if none supplied
    if (!cursor) {
      const { data, error, response } = await client.GET('/orgs', {
        params: {
          query: {
            limit: this.chunkSize,
          },
        },
      });

      if (error || !response.ok || !data?.success || !data?.data?.items) {
        throw new Error(
          `Failed to fetch initial organizations: ${response.status} ${response.statusText}`,
        );
      }

      const orgItems = data.data.items as ModelsOrganization[];
      const metadata = data.data.metadata as ResponseMetadata | undefined;
      const entities: Entity[] = orgItems.map(o =>
        this.translator.translateOrganizationToDomain(o),
      );

      const hasMore = metadata?.hasMore && !!metadata?.continue;
      const nextCursorVal = metadata?.continue;

      const initial: CursorTraversalCursor = {
        phase: hasMore ? 'orgs' : 'projects',
        orgApiCursor: nextCursorVal,
        orgQueue: orgItems.map(o => o.name!),
        currentOrgIndex: 0,
        projectApiCursor: undefined,
        projectQueue: [],
        currentProjectIndex: 0,
        componentApiCursor: undefined,
      };

      return {
        done: false,
        entities: entities.map(entity => ({ entity })),
        cursor: initial,
      };
    }

    switch (cursor.phase) {
      case 'orgs':
        return this.processOrganizationsCursor(client, context, cursor);
      case 'projects':
        return this.processProjectsCursor(client, context, cursor);
      case 'components':
        return this.processComponentsCursor(client, context, cursor);
      default:
        return { done: true };
    }
  }

  private async processOrganizationsCursor(
    client: ReturnType<typeof createOpenChoreoApiClient>,
    context: OpenChoreoContext,
    cursor: CursorTraversalCursor,
  ): Promise<EntityIteratorResult<CursorTraversalCursor>> {
    if (!cursor.orgApiCursor) {
      // No more organization pages, transition to projects phase
      return {
        done: false,
        entities: [],
        cursor: {
          ...cursor,
          phase: 'projects',
          currentOrgIndex: 0,
        },
      };
    }

    let data;
    let error;
    let response;
    try {
      const result = await client.GET('/orgs', {
        params: {
          query: {
            limit: this.chunkSize,
            continue: cursor.orgApiCursor,
          },
        },
      });
      data = result.data;
      error = result.error;
      response = result.response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Check if this is an expired cursor error (HTTP 410)
      if (
        errorMessage.includes('410') ||
        errorMessage.includes('expired') ||
        errorMessage.includes('continue parameter is too old')
      ) {
        context.logger.warn(
          'Expired cursor detected for organizations, restarting fetch from beginning',
        );

        // Restart organization fetch without cursor
        const restartResult = await client.GET('/orgs', {
          params: {
            query: {
              limit: this.chunkSize,
            },
          },
        });

        if (
          restartResult.error ||
          !restartResult.response.ok ||
          !restartResult.data?.success ||
          !restartResult.data?.data?.items
        ) {
          throw new Error(
            `Failed to restart organization fetch: ${restartResult.response.status}`,
          );
        }

        const items = restartResult.data.data.items as ModelsOrganization[];
        const metadata = restartResult.data.data.metadata as
          | ResponseMetadata
          | undefined;

        // Reset the organization cursor and clear org queue since we're starting over
        const newOrgQueue = items.map((o: ModelsOrganization) => o.name!);

        const entities: Entity[] = items.map((o: ModelsOrganization) =>
          this.translator.translateOrganizationToDomain(o),
        );

        const hasMore = metadata?.hasMore && !!metadata?.continue;

        return {
          done: false,
          entities: entities.map(entity => ({ entity })),
          cursor: {
            ...cursor,
            orgApiCursor: metadata?.continue,
            orgQueue: newOrgQueue,
            phase: hasMore ? 'orgs' : 'projects',
          },
        };
      }

      // Re-throw other errors
      throw err;
    }

    if (error || !response.ok || !data?.success || !data?.data?.items) {
      // Handle HTTP 410 specifically
      if (response.status === 410) {
        context.logger.warn(
          'Pagination token expired (410 Gone) for organizations, restarting fetch',
        );
        return this.processOrganizationsCursor(client, context, {
          ...cursor,
          orgApiCursor: undefined,
        });
      }
      throw new Error(
        `Failed to fetch organizations: ${response.status} ${response.statusText}`,
      );
    }

    const items = data.data.items as ModelsOrganization[];
    const metadata = data.data.metadata as ResponseMetadata | undefined;
    const entities: Entity[] = items.map((o: ModelsOrganization) =>
      this.translator.translateOrganizationToDomain(o),
    );

    // Append to orgQueue
    const newOrgQueue = cursor.orgQueue.concat(
      items.map((o: ModelsOrganization) => o.name!),
    );
    const hasMore = metadata?.hasMore && !!metadata?.continue;

    return {
      done: false,
      entities: entities.map(entity => ({ entity })),
      cursor: {
        ...cursor,
        orgApiCursor: metadata?.continue,
        orgQueue: newOrgQueue,
        phase: hasMore ? 'orgs' : 'projects',
      },
    };
  }

  private async processProjectsCursor(
    client: ReturnType<typeof createOpenChoreoApiClient>,
    context: OpenChoreoContext,
    cursor: CursorTraversalCursor,
  ): Promise<EntityIteratorResult<CursorTraversalCursor>> {
    // If we've processed all organizations, transition to components phase
    if (cursor.currentOrgIndex >= cursor.orgQueue.length) {
      return {
        done: false,
        entities: [],
        cursor: {
          ...cursor,
          phase: 'components',
          currentProjectIndex: 0,
        },
      };
    }

    const currentOrg = cursor.orgQueue[cursor.currentOrgIndex];

    let data;
    let error;
    let response;
    try {
      const result = await client.GET('/orgs/{orgName}/projects', {
        params: {
          path: { orgName: currentOrg },
          query: {
            limit: this.chunkSize,
            ...(cursor.projectApiCursor && {
              continue: cursor.projectApiCursor,
            }),
          },
        },
      });
      data = result.data;
      error = result.error;
      response = result.response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Check if this is an expired cursor error
      if (
        errorMessage.includes('410') ||
        errorMessage.includes('expired') ||
        errorMessage.includes('continue parameter is too old')
      ) {
        context.logger.warn(
          `Expired cursor detected for projects in org ${currentOrg}, restarting fetch from beginning`,
        );

        // Restart project fetch for this organization without cursor
        const restartResult = await client.GET('/orgs/{orgName}/projects', {
          params: {
            path: { orgName: currentOrg },
            query: {
              limit: this.chunkSize,
            },
          },
        });

        if (
          restartResult.error ||
          !restartResult.response.ok ||
          !restartResult.data?.success
        ) {
          throw new Error(
            `Failed to restart project fetch for ${currentOrg}: ${restartResult.response.status}`,
          );
        }

        // Clear the existing project queue for this org and rebuild it
        cursor.projectQueue = cursor.projectQueue.filter(
          p => p.org !== currentOrg,
        );
        cursor.projectApiCursor = undefined;

        data = restartResult.data;
        response = restartResult.response;
        error = restartResult.error;
      } else {
        // Re-throw other errors
        throw err;
      }
    }

    if (error || !response.ok || !data?.success) {
      // Handle HTTP 410 specifically
      if (response.status === 410) {
        context.logger.warn(
          `Pagination token expired (410 Gone) for projects in ${currentOrg}, restarting`,
        );
        return this.processProjectsCursor(client, context, {
          ...cursor,
          projectApiCursor: undefined,
        });
      }
      throw new Error(
        `Failed to fetch projects for ${currentOrg}: ${response.status} ${response.statusText}`,
      );
    }

    const items = (data.data?.items || []) as ModelsProject[];
    const metadata = data.data?.metadata as ResponseMetadata | undefined;
    const entities: Entity[] = items.map((p: ModelsProject) =>
      this.translator.translateProjectToEntity(p, currentOrg),
    );

    // Accumulate project names for component phase
    const newProjectPairs = items.map((p: ModelsProject) => ({
      org: currentOrg,
      project: p.name!,
    }));
    const projectQueue = cursor.projectQueue.concat(newProjectPairs);

    const hasMore = metadata?.hasMore && !!metadata?.continue;

    if (!hasMore) {
      // Finished this organization, move to next org
      return {
        done: false,
        entities: entities.map(entity => ({ entity })),
        cursor: {
          ...cursor,
          projectApiCursor: undefined,
          currentOrgIndex: cursor.currentOrgIndex + 1,
          projectQueue,
          currentOrg,
        },
      };
    }

    return {
      done: false,
      entities: entities.map(entity => ({ entity })),
      cursor: {
        ...cursor,
        projectApiCursor: metadata?.continue,
        projectQueue,
        currentOrg,
      },
    };
  }

  private async processComponentsCursor(
    client: ReturnType<typeof createOpenChoreoApiClient>,
    context: OpenChoreoContext,
    cursor: CursorTraversalCursor,
  ): Promise<EntityIteratorResult<CursorTraversalCursor>> {
    // If all projects processed -> done
    if (cursor.currentProjectIndex >= cursor.projectQueue.length) {
      return { done: true };
    }

    const { org, project } = cursor.projectQueue[cursor.currentProjectIndex];

    let data;
    let error;
    let response;
    try {
      const result = await client.GET(
        '/orgs/{orgName}/projects/{projectName}/components',
        {
          params: {
            path: { orgName: org, projectName: project },
            query: {
              limit: this.chunkSize,
              ...(cursor.componentApiCursor && {
                continue: cursor.componentApiCursor,
              }),
            },
          },
        },
      );
      data = result.data;
      error = result.error;
      response = result.response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Check if this is an expired cursor error (HTTP 410)
      if (
        errorMessage.includes('410') ||
        errorMessage.includes('expired') ||
        errorMessage.includes('continue parameter is too old')
      ) {
        context.logger.warn(
          `Expired cursor detected for ${org}/${project}, restarting component fetch from beginning. Error: ${errorMessage}`,
        );

        // Restart component fetch for this project without cursor
        const restartResult = await client.GET(
          '/orgs/{orgName}/projects/{projectName}/components',
          {
            params: {
              path: { orgName: org, projectName: project },
              query: {
                limit: this.chunkSize,
              },
            },
          },
        );

        if (
          restartResult.error ||
          !restartResult.response.ok ||
          !restartResult.data?.success
        ) {
          throw new Error(
            `Failed to restart component fetch for ${org}/${project}: ${restartResult.response.status}`,
          );
        }

        // Reset the component cursor in the traversal state
        cursor.componentApiCursor = undefined;

        data = restartResult.data;
        response = restartResult.response;
        error = restartResult.error;
      } else {
        // Re-throw other errors
        context.logger.error(
          `Non-cursor error in ${org}/${project}: ${errorMessage}`,
        );
        throw err;
      }
    }

    if (error || !response.ok || !data?.success) {
      // Handle HTTP 410 specifically
      if (response.status === 410) {
        context.logger.warn(
          `Pagination token expired (410 Gone) for components in ${org}/${project}, restarting`,
        );
        return this.processComponentsCursor(client, context, {
          ...cursor,
          componentApiCursor: undefined,
        });
      }
      throw new Error(
        `Failed to fetch components for ${org}/${project}: ${response.status} ${response.statusText}`,
      );
    }

    const items = (data.data?.items || []) as ModelsComponent[];
    const metadata = data.data?.metadata as ResponseMetadata | undefined;

    // Use batch processing for components to reduce N+1 API calls
    const batchedEntities =
      await this.batchProcessor.translateComponentsWithApisBatch(
        client,
        items,
        org,
        project,
        context,
      );

    const hasMore = metadata?.hasMore && !!metadata?.continue;

    if (!hasMore) {
      // Finished this project, move to next project
      return {
        done: false,
        entities: batchedEntities.map(entity => ({ entity })),
        cursor: {
          ...cursor,
          componentApiCursor: undefined,
          currentProjectIndex: cursor.currentProjectIndex + 1,
          currentOrg: org,
          currentProject: project,
        },
      };
    }

    return {
      done: false,
      entities: batchedEntities.map(entity => ({ entity })),
      cursor: {
        ...cursor,
        componentApiCursor: metadata?.continue,
        currentOrg: org,
        currentProject: project,
      },
    };
  }
}
