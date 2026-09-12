import type { Config } from '@backstage/config';
import type { LoggerService } from '@backstage/backend-plugin-api';
import { Entity } from '@backstage/catalog-model';
import {
  createOpenChoreoApiClient,
  getCreatedAt,
  getDeletionTimestamp,
  getDescription,
  getDisplayName,
  getName,
  getNamespace,
  getUid,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';
import { ComponentTypeUtils } from '@openchoreo/backstage-plugin-common';
import {
  translateNamespaceToDomainEntity,
  translateProjectToEntity,
} from '@openchoreo/backstage-plugin-catalog-backend-module';
import type { EntityIteratorResult, IncrementalEntityProvider } from '../types';
import { ComponentBatchProcessor } from './componentBatchProcessor';

// New-API resource shapes returned by the typed client
type NewNamespace = OpenChoreoComponents['schemas']['Namespace'];
type NewProject = OpenChoreoComponents['schemas']['Project'];

/** The typed OpenChoreo API client returned by createOpenChoreoApiClient. */
export type OpenChoreoApiClient = ReturnType<typeof createOpenChoreoApiClient>;

/**
 * Incremental entity provider for OpenChoreo.
 * Processes entities in phases (namespaces, projects, components) using
 * cursor-based pagination to enable efficient, resumable ingestion of large
 * datasets.
 *
 * ## Iterator Semantics
 * - `done: false` = Continue iteration, more batches available
 * - `done: true` = Iteration complete, no more data to process
 *
 * **Important**: `done: false` means overall iteration continues, NOT that
 * the current resource has more items. When a resource is exhausted, we
 * return `done: false` and advance to the next resource. Only when ALL
 * phases complete do we return `done: true`.
 *
 * One page of one phase is fetched per `next()` call; the cursor is
 * persisted between bursts by the ingestion engine, which makes the
 * traversal resumable across process restarts.
 */

interface CursorTraversalCursor {
  phase: 'namespaces' | 'projects' | 'components';
  namespaceApiCursor?: string;
  projectApiCursor?: string;
  componentApiCursor?: string;
  namespaceQueue: string[];
  currentIndex: number;
  currentNamespace?: string;
}

export type OpenChoreoCursor = CursorTraversalCursor;

// Context for API client and shared state
export interface OpenChoreoContext {
  baseUrl: string;
  logger: LoggerService;
  token?: string;
}

/** Extracts a human-readable message from an openapi-fetch error object. */
function extractErrorMessage(error: unknown): string {
  return typeof error === 'object' && error !== null && 'message' in error
    ? (error as { message: string }).message
    : JSON.stringify(error);
}

/**
 * Incremental entity provider for OpenChoreo that processes entities in
 * phases using cursor-based pagination for efficient, resumable ingestion of
 * large datasets. Processes namespaces, projects, and components in sequence
 * with memory-efficient chunking. Supports progressive traversal through
 * large catalogs without requiring full data loading.
 */
export class OpenChoreoIncrementalEntityProvider
  implements IncrementalEntityProvider<OpenChoreoCursor, OpenChoreoContext>
{
  // The OpenAPI schema caps page size at 100 (LimitParam maximum)
  private static readonly API_MAX_PAGE_LIMIT = 100;

  private readonly config: Config;
  private readonly logger: LoggerService;
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly chunkSize: number;
  private readonly defaultOwner: string;
  private readonly componentTypeUtils: ComponentTypeUtils;
  private readonly batchProcessor: ComponentBatchProcessor;

  /**
   * Creates a new instance of the incremental entity provider
   * @param options - Backstage config and logger for OpenChoreo settings
   */
  constructor(readonly options: { config: Config; logger: LoggerService }) {
    this.config = options.config;
    this.logger = options.logger;
    this.baseUrl = this.config.getString('openchoreo.baseUrl');
    this.token = this.config.getOptionalString('openchoreo.token');

    const configuredChunkSize =
      this.config.getOptionalNumber('openchoreo.incremental.chunkSize') || 100;
    this.chunkSize = Math.min(
      configuredChunkSize,
      OpenChoreoIncrementalEntityProvider.API_MAX_PAGE_LIMIT,
    );
    if (this.chunkSize < configuredChunkSize) {
      this.logger.debug(
        `Configured chunkSize ${configuredChunkSize} exceeds API max; capping to ${this.chunkSize}`,
      );
    }

    // Default owner for built-in Backstage entities (Domain, System,
    // Component). These kinds require an owner per Backstage schema
    // validation. Qualified with the 'default' namespace so the owner
    // resolves correctly for entities in non-default namespaces.
    const ownerName =
      this.config.getOptionalString('openchoreo.defaultOwner') ||
      'openchoreo-users';
    this.defaultOwner = `group:default/${ownerName}`;

    this.componentTypeUtils = ComponentTypeUtils.fromConfig(this.config);
    this.batchProcessor = new ComponentBatchProcessor({
      locationKey: `provider:${this.getProviderName()}`,
      defaultOwner: this.defaultOwner,
      componentTypeUtils: this.componentTypeUtils,
    });
  }

  getProviderName(): string {
    return 'OpenChoreoIncrementalEntityProvider';
  }

  /**
   * Sets up the provider context for a burst of processing.
   * @param burst - Function to execute with the prepared context
   */
  async around(
    burst: (context: OpenChoreoContext) => Promise<void>,
  ): Promise<void> {
    const context: OpenChoreoContext = {
      baseUrl: this.baseUrl,
      logger: this.logger,
      token: this.token,
    };

    await burst(context);
  }

  /**
   * Processes the next batch of entities using cursor-based pagination.
   * Exactly one API page is fetched per call; the returned cursor captures
   * the full traversal state so the next call can resume seamlessly.
   * @param context - Provider context with baseUrl and logger
   * @param cursor - Current traversal state for resumable processing
   * @returns Iterator result with entities and next cursor state
   */
  async next(
    context: OpenChoreoContext,
    cursor?: OpenChoreoCursor,
  ): Promise<EntityIteratorResult<OpenChoreoCursor>> {
    const client = createOpenChoreoApiClient({
      baseUrl: context.baseUrl,
      token: context.token,
      logger: context.logger,
    });

    if (!cursor) {
      return this.processInitialPage(client);
    }

    switch (cursor.phase) {
      case 'namespaces':
        return this.processNamespacesPhase(client, cursor);
      case 'projects':
        return this.processProjectsPhase(client, cursor);
      case 'components':
        return this.processComponentsPhase(client, context, cursor);
      default:
        return { done: true }; // Unknown phase = complete iteration
    }
  }

  // ===================== Phase implementations ===================== //

  /**
   * Fetches the first page of namespaces and seeds the traversal cursor.
   */
  private async processInitialPage(
    client: OpenChoreoApiClient,
  ): Promise<EntityIteratorResult<OpenChoreoCursor>> {
    const res = await client.GET('/api/v1/namespaces', {
      params: { query: { limit: this.chunkSize } },
    });
    if (res.error || !res.data) {
      throw new Error(
        `Failed to fetch namespaces: ${res.response.status} ${
          res.response.statusText
        } - ${extractErrorMessage(res.error)}`,
      );
    }

    const items = res.data.items ?? [];
    const entities: Entity[] = items.map(ns => this.translateNamespace(ns));
    const namespaceQueue = items
      .map(ns => getName(ns))
      .filter((name): name is string => Boolean(name));
    const nextCursor = res.data.pagination?.nextCursor;

    const initial: CursorTraversalCursor = {
      phase: nextCursor ? 'namespaces' : 'projects',
      namespaceApiCursor: nextCursor,
      namespaceQueue,
      currentIndex: 0,
    };

    return {
      done: false,
      entities: entities.map(entity => ({ entity })),
      cursor: initial,
    };
  }

  /**
   * Phase 'namespaces': pages through the namespace list, emitting Domain
   * entities and appending names to the queue. Transitions to the projects
   * phase once the namespace list is exhausted.
   */
  private async processNamespacesPhase(
    client: OpenChoreoApiClient,
    cursor: CursorTraversalCursor,
  ): Promise<EntityIteratorResult<OpenChoreoCursor>> {
    if (!cursor.namespaceApiCursor) {
      // No more namespace pages — transition to the projects phase.
      // Note: done:false = continue iteration, not current resource has
      // more items.
      return {
        done: false,
        entities: [],
        cursor: {
          ...cursor,
          phase: 'projects',
          currentIndex: 0,
        },
      };
    }

    const res = await client.GET('/api/v1/namespaces', {
      params: {
        query: {
          limit: this.chunkSize,
          cursor: cursor.namespaceApiCursor,
        },
      },
    });
    if (res.error || !res.data) {
      throw new Error(
        `Failed to fetch namespaces: ${res.response.status} ${
          res.response.statusText
        } - ${extractErrorMessage(res.error)}`,
      );
    }

    const nextCursor = res.data.pagination?.nextCursor;
    this.assertCursorAdvances(
      cursor.namespaceApiCursor,
      nextCursor,
      'namespaces',
    );

    const items = res.data.items ?? [];
    const entities: Entity[] = items.map(ns => this.translateNamespace(ns));
    const newNames = items
      .map(ns => getName(ns))
      .filter((name): name is string => Boolean(name));

    return {
      done: false,
      entities: entities.map(entity => ({ entity })),
      cursor: {
        ...cursor,
        namespaceApiCursor: nextCursor,
        namespaceQueue: cursor.namespaceQueue.concat(newNames),
        phase: nextCursor ? 'namespaces' : 'projects',
        currentIndex: 0,
      },
    };
  }

  /**
   * Phase 'projects': pages through the project list of each queued
   * namespace in turn, emitting System entities. Transitions to the
   * components phase once every namespace's projects are exhausted.
   */
  private async processProjectsPhase(
    client: OpenChoreoApiClient,
    cursor: CursorTraversalCursor,
  ): Promise<EntityIteratorResult<OpenChoreoCursor>> {
    if (cursor.currentIndex >= cursor.namespaceQueue.length) {
      // All namespaces' projects processed — transition to components.
      // Note: done:false = continue iteration, not current resource has
      // more items.
      return {
        done: false,
        entities: [],
        cursor: {
          ...cursor,
          phase: 'components',
          currentIndex: 0,
          projectApiCursor: undefined,
        },
      };
    }

    const namespaceName = cursor.namespaceQueue[cursor.currentIndex];

    const res = await client.GET(
      '/api/v1/namespaces/{namespaceName}/projects',
      {
        params: {
          path: { namespaceName },
          query: {
            limit: this.chunkSize,
            ...(cursor.projectApiCursor && { cursor: cursor.projectApiCursor }),
          },
        },
      },
    );
    if (res.error || !res.data) {
      throw new Error(
        `Failed to fetch projects for namespace ${namespaceName}: ${
          res.response.status
        } ${res.response.statusText} - ${extractErrorMessage(res.error)}`,
      );
    }

    const nextCursor = res.data.pagination?.nextCursor;
    this.assertCursorAdvances(
      cursor.projectApiCursor,
      nextCursor,
      `projects in namespace ${namespaceName}`,
    );

    const items = res.data.items ?? [];
    const entities: Entity[] = items.map(project =>
      this.translateProject(project, namespaceName),
    );

    if (!nextCursor) {
      // Finished this namespace's projects — move to the next namespace.
      // Note: done:false = continue iteration, not current resource has
      // more items.
      return {
        done: false,
        entities: entities.map(entity => ({ entity })),
        cursor: {
          ...cursor,
          projectApiCursor: undefined,
          currentIndex: cursor.currentIndex + 1,
          currentNamespace: namespaceName,
        },
      };
    }

    return {
      done: false,
      entities: entities.map(entity => ({ entity })),
      cursor: {
        ...cursor,
        projectApiCursor: nextCursor,
        currentNamespace: namespaceName,
      },
    };
  }

  /**
   * Phase 'components': pages through the FLAT component list of each
   * queued namespace (no project filter), delegating translation to the
   * batch processor. The owning project of each component is read from its
   * spec (`spec.owner.projectName`). This is the only phase that can
   * return `done: true`.
   */
  private async processComponentsPhase(
    client: OpenChoreoApiClient,
    context: OpenChoreoContext,
    cursor: CursorTraversalCursor,
  ): Promise<EntityIteratorResult<OpenChoreoCursor>> {
    if (cursor.currentIndex >= cursor.namespaceQueue.length) {
      return { done: true }; // Iteration complete — no more data
    }

    const namespaceName = cursor.namespaceQueue[cursor.currentIndex];

    const res = await client.GET(
      '/api/v1/namespaces/{namespaceName}/components',
      {
        params: {
          path: { namespaceName },
          query: {
            limit: this.chunkSize,
            ...(cursor.componentApiCursor && {
              cursor: cursor.componentApiCursor,
            }),
          },
        },
      },
    );
    if (res.error || !res.data) {
      throw new Error(
        `Failed to fetch components for namespace ${namespaceName}: ${
          res.response.status
        } ${res.response.statusText} - ${extractErrorMessage(res.error)}`,
      );
    }

    const nextCursor = res.data.pagination?.nextCursor;
    this.assertCursorAdvances(
      cursor.componentApiCursor,
      nextCursor,
      `components in namespace ${namespaceName}`,
    );

    const items = res.data.items ?? [];
    const entities = await this.batchProcessor.translateComponentsWithApisBatch(
      client,
      items,
      namespaceName,
      { logger: context.logger, config: this.config },
    );

    if (!nextCursor) {
      // Finished this namespace's components — move to the next namespace.
      // Note: done:false = continue iteration, not current resource has
      // more items.
      return {
        done: false,
        entities: entities.map(entity => ({ entity })),
        cursor: {
          ...cursor,
          componentApiCursor: undefined,
          currentIndex: cursor.currentIndex + 1,
          currentNamespace: namespaceName,
        },
      };
    }

    return {
      done: false,
      entities: entities.map(entity => ({ entity })),
      cursor: {
        ...cursor,
        componentApiCursor: nextCursor,
        currentNamespace: namespaceName,
      },
    };
  }

  // ===================== Translation helpers ===================== //

  /**
   * Translates a new-API Namespace into a Backstage Domain entity using the
   * shared translator from the non-incremental module.
   */
  private translateNamespace(namespace: NewNamespace): Entity {
    return translateNamespaceToDomainEntity(
      {
        name: getName(namespace)!,
        displayName: getDisplayName(namespace),
        description: getDescription(namespace),
        createdAt: getCreatedAt(namespace),
        status: namespace.status?.phase,
      },
      {
        locationKey: this.getProviderName(),
        defaultOwner: this.defaultOwner,
      },
    );
  }

  /**
   * Translates a new-API Project into a Backstage System entity using the
   * shared translator from the non-incremental module.
   */
  private translateProject(project: NewProject, namespaceName: string): Entity {
    return translateProjectToEntity(
      {
        name: getName(project)!,
        displayName: getDisplayName(project),
        description: getDescription(project),
        namespaceName: getNamespace(project) ?? namespaceName,
        uid: getUid(project),
        deletionTimestamp: getDeletionTimestamp(project),
        deploymentPipelineRef: project.spec?.deploymentPipelineRef?.name,
        projectTypeName: project.spec?.type?.name,
        projectTypeKind: project.spec?.type?.kind,
      },
      namespaceName,
      {
        locationKey: this.getProviderName(),
        defaultOwner: this.defaultOwner,
      },
    );
  }

  // ===================== Guards ===================== //

  /**
   * Guards against a server returning the exact cursor that was just sent,
   * which would loop the traversal forever. Throwing here lets the
   * ingestion engine back off and retry the burst.
   */
  private assertCursorAdvances(
    sentCursor: string | undefined,
    receivedCursor: string | undefined,
    label: string,
  ): void {
    if (receivedCursor && sentCursor && receivedCursor === sentCursor) {
      throw new Error(
        `OpenChoreo API returned the same pagination cursor for ${label} twice ` +
          `('${receivedCursor.substring(
            0,
            50,
          )}'); aborting to avoid an infinite loop`,
      );
    }
  }
}
