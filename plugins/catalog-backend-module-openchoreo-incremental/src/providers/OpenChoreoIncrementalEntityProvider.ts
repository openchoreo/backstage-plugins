import { IncrementalEntityProvider, EntityIteratorResult } from '../types';
import { createOpenChoreoApiClient } from '@openchoreo/backstage-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import { EntityTranslator } from './entityTranslator';

/**
 * Incremental entity provider for OpenChoreo.
 * Processes entities in phases (organizations, projects, components) using cursor-based pagination
 * to enable efficient, resumable ingestion of large datasets.
 */

interface CursorTraversalCursor {
  phase: 'orgs' | 'projects' | 'components';
  orgApiCursor?: string;
  projectApiCursor?: string;
  componentApiCursor?: string;
  orgQueue: string[];
  currentOrgIndex: number;
  projectQueue: { org: string; project: string }[];
  currentProjectIndex: number;
  currentOrg?: string;
  currentProject?: string;
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
  private readonly config: Config;
  private readonly logger: LoggerService;
  private readonly chunkSize: number;
  private readonly translator: EntityTranslator;
  private mode: 'cursor' | 'legacy' = 'cursor';

  /**
   * Creates a new instance of the incremental entity provider
   * @param config - Backstage configuration for OpenChoreo settings
   * @param logger - Logger service for operational logging
   */
  constructor(config: Config, logger: LoggerService) {
    this.config = config;
    this.logger = logger;
    this.chunkSize =
      config.getOptionalNumber('openchoreo.incremental.chunkSize') || 50;
    this.translator = new EntityTranslator(this.getProviderName());
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
    const client = createOpenChoreoApiClient(this.config, this.logger);
    try {
      const probe = await client.getOrganizationsWithCursor({
        limit: this.chunkSize,
      });
      const supportsCursor = !!probe?.data && 'nextCursor' in probe.data;
      if (!supportsCursor) {
        this.logger.warn(
          'OpenChoreo API response missing "nextCursor" field, falling back to legacy pagination mode',
        );
        this.mode = 'legacy';
      } else {
        this.logger.info('OpenChoreo API supports cursor pagination');
        this.mode = 'cursor';
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('HTTP 404')) {
        this.logger.warn(
          `Cursor endpoint not found (HTTP 404). OpenChoreo API does not support cursor pagination. Falling back to legacy pagination mode using baseUrl: ${this.config.getString(
            'openchoreo.baseUrl',
          )}`,
        );
        this.mode = 'legacy';
      } else if (error instanceof SyntaxError) {
        throw new Error(
          `OpenChoreo API returned malformed JSON (SyntaxError). This is a critical server-side bug. Please report this to your OpenChoreo API administrator immediately. Error: ${errorMessage}`,
        );
      } else {
        this.logger.error(
          `Failed to probe cursor pagination support: ${errorMessage}`,
        );
        throw error;
      }
    }

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
      if (this.mode === 'legacy') {
        return await this.nextLegacyMode(context, cursor);
      }
      return await this.nextCursorMode(context, cursor);
    } catch (error) {
      context.logger.error(`Error processing OpenChoreo entities: ${error}`);
      throw error;
    }
  }

  // ===================== Legacy Mode Implementation ===================== //

  /**
   * Processes all entities using legacy getAllOrganizations/Projects/Components methods
   * Fetches everything in one batch since legacy API doesn't support pagination
   * @param context - Provider context with config and logger
   * @param cursor - Ignored for legacy mode (processes everything at once)
   * @returns Iterator result with all entities marked as done
   */
  private async nextLegacyMode(
    context: OpenChoreoContext,
    cursor?: OpenChoreoCursor,
  ): Promise<EntityIteratorResult<OpenChoreoCursor>> {
    if (cursor) {
      return { done: true };
    }

    const client = createOpenChoreoApiClient(context.config, context.logger);
    const allEntities: Entity[] = [];

    const organizations = await client.getAllOrganizations();
    context.logger.info(
      `Found ${organizations.length} organizations (legacy mode)`,
    );

    for (const org of organizations) {
      allEntities.push(this.translator.translateOrganizationToDomain(org));
    }

    for (const org of organizations) {
      try {
        const projects = await client.getAllProjects(org.name);
        context.logger.info(
          `Found ${projects.length} projects in organization: ${org.name}`,
        );

        for (const project of projects) {
          allEntities.push(
            this.translator.translateProjectToEntity(project, org.name),
          );
        }

        for (const project of projects) {
          try {
            const components = await client.getAllComponents(
              org.name,
              project.name,
            );
            context.logger.info(
              `Found ${components.length} components in project: ${project.name}`,
            );

            for (const component of components) {
              await this.translateComponentWithApis(
                client,
                component,
                org.name,
                project.name,
                allEntities,
                context,
              );
            }
          } catch (error) {
            context.logger.warn(
              `Failed to fetch components for project ${project.name}: ${error}`,
            );
          }
        }
      } catch (error) {
        context.logger.warn(
          `Failed to fetch projects for organization ${org.name}: ${error}`,
        );
      }
    }

    context.logger.info(
      `Successfully processed ${allEntities.length} entities in legacy mode`,
    );

    return {
      done: true,
      entities: allEntities.map(entity => ({ entity })),
    };
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
    const client = createOpenChoreoApiClient(context.config, context.logger);

    // Initialize cursor if none supplied
    if (!cursor) {
      const orgResp = await client.getOrganizationsWithCursor({
        limit: this.chunkSize,
      });
      const orgItems = orgResp.data.items || [];
      const entities: Entity[] = orgItems.map(o =>
        this.translator.translateOrganizationToDomain(o),
      );

      const hasMore = !!orgResp.data.nextCursor;
      const nextCursorVal = orgResp.data.nextCursor;

      const initial: CursorTraversalCursor = {
        phase: hasMore ? 'orgs' : 'projects',
        orgApiCursor: nextCursorVal,
        orgQueue: orgItems.map(o => o.name),
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
    client: any,
    _context: OpenChoreoContext,
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

    const resp = await client.getOrganizationsWithCursor({
      cursor: cursor.orgApiCursor,
      limit: this.chunkSize,
    });
    const items = resp.data.items || [];
    const entities: Entity[] = items.map((o: any) =>
      this.translator.translateOrganizationToDomain(o),
    );

    // Append to orgQueue
    const newOrgQueue = cursor.orgQueue.concat(items.map((o: any) => o.name));
    const hasMore = !!resp.data.nextCursor;

    return {
      done: false,
      entities: entities.map(entity => ({ entity })),
      cursor: {
        ...cursor,
        orgApiCursor: resp.data.nextCursor,
        orgQueue: newOrgQueue,
        phase: hasMore ? 'orgs' : 'projects',
      },
    };
  }

  private async processProjectsCursor(
    client: any,
    _context: OpenChoreoContext,
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

    // Fetch next page of projects for current organization
    const resp = await client.getProjectsWithCursor(currentOrg, {
      cursor: cursor.projectApiCursor,
      limit: this.chunkSize,
    });

    const items = resp.data.items || [];
    const entities: Entity[] = items.map((p: any) =>
      this.translator.translateProjectToEntity(p, currentOrg),
    );

    // Accumulate project names for component phase
    const newProjectPairs = items.map((p: any) => ({
      org: currentOrg,
      project: p.name,
    }));
    const projectQueue = cursor.projectQueue.concat(newProjectPairs);

    const nextProjectCursor = resp.data.nextCursor;
    const hasMore = !!nextProjectCursor;

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
        projectApiCursor: nextProjectCursor,
        projectQueue,
        currentOrg,
      },
    };
  }

  private async processComponentsCursor(
    client: any,
    context: OpenChoreoContext,
    cursor: CursorTraversalCursor,
  ): Promise<EntityIteratorResult<CursorTraversalCursor>> {
    // If all projects processed -> done
    if (cursor.currentProjectIndex >= cursor.projectQueue.length) {
      return { done: true };
    }

    const { org, project } = cursor.projectQueue[cursor.currentProjectIndex];

    // Fetch paginated components for current project
    const resp = await client.getComponentsWithCursor(org, project, {
      cursor: cursor.componentApiCursor,
      limit: this.chunkSize,
    });
    const items = resp.data.items || [];

    const entities: Entity[] = [];
    for (const component of items) {
      await this.translateComponentWithApis(
        client,
        component,
        org,
        project,
        entities,
        context,
      );
    }

    const nextComponentCursor = resp.data.nextCursor;
    const hasMore = !!nextComponentCursor;

    if (!hasMore) {
      // Finished this project, move to next project
      return {
        done: false,
        entities: entities.map(entity => ({ entity })),
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
      entities: entities.map(entity => ({ entity })),
      cursor: {
        ...cursor,
        componentApiCursor: nextComponentCursor,
        currentOrg: org,
        currentProject: project,
      },
    };
  }

  // ===================== Shared Helpers ===================== //

  /**
   * Translates component data to Backstage entities with API enrichment
   * For Service components, fetches complete details including API specifications
   * Falls back to basic translation if detailed fetch fails
   * @param client - API client for fetching component details
   * @param component - Raw component data from API
   * @param orgName - Organization name for context
   * @param projectName - Project name for context
   * @param out - Array to collect translated entities
   * @param context - Provider context for logging
   */
  private async translateComponentWithApis(
    client: any,
    component: any,
    orgName: string,
    projectName: string,
    out: Entity[],
    context: OpenChoreoContext,
  ) {
    if (component.type === 'Service') {
      try {
        const completeComponent = await client.getComponent(
          orgName,
          projectName,
          component.name,
        );
        const { componentEntity, apiEntities } =
          this.translator.processServiceComponentWithCursor(
            completeComponent,
            orgName,
            projectName,
          );
        out.push(componentEntity, ...apiEntities);
      } catch (error) {
        context.logger.warn(
          `Failed to fetch complete component details for ${component.name}: ${error}`,
        );
        const fallback = this.translator.translateComponentToEntity(
          component,
          orgName,
          projectName,
        );
        out.push(fallback);
      }
      return;
    }
    const basic = this.translator.translateComponentToEntity(
      component,
      orgName,
      projectName,
    );
    out.push(basic);
  }
}
