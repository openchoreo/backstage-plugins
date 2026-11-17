import { LoggerService } from '@backstage/backend-plugin-api';
import { ConflictError } from '@backstage/errors';
import {
  createOpenChoreoApiClient,
  extractErrorMessage,
  requireApiResponse,
} from '@openchoreo/openchoreo-client-node';
import type {
  BindingRevisionHistoryLimit,
  DeleteBindingRevisionResponse,
  ReleaseBindingRevision,
  ResourceReleaseBindingRevision,
  RollbackResponse,
} from '@openchoreo/backstage-plugin-common';

// Revision history is capped per binding by the controller, so a few pages
// always cover it; the cap only guards against a cursor that never ends.
const PAGE_LIMIT = 100;
const MAX_PAGES = 20;

/**
 * Follows the list cursor until it ends. Fails rather than return a partial
 * history when the cursor has not ended after MAX_PAGES pages.
 */
async function readAllPages<T>(
  fetchPage: (cursor?: string) => Promise<{
    items: T[];
    pagination?: { nextCursor?: string };
  }>,
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await fetchPage(cursor);
    items.push(...data.items);
    cursor = data.pagination?.nextCursor;
    if (!cursor) return items;
  }
  throw new Error(
    `Revision history has more than ${
      MAX_PAGES * PAGE_LIMIT
    } revisions; not showing a partial history`,
  );
}

/**
 * Turns a 409 into a ConflictError that keeps the API's error code
 * (RELEASE_DELETED, CONCURRENT_MODIFICATION or REVISION_PROTECTED), so the
 * frontend can tell them apart. Returns nothing for any other status.
 */
function conflictWithCode(
  status: number,
  error: unknown,
  fallbackMessage: string,
): ConflictError | undefined {
  if (status !== 409) return undefined;
  const conflict = new ConflictError(
    extractErrorMessage(error) ?? fallbackMessage,
  );
  const code = (error as { code?: unknown } | undefined)?.code;
  if (typeof code === 'string') {
    Object.assign(conflict, { code });
  }
  return conflict;
}

/**
 * BFF service for ReleaseBinding and ResourceReleaseBinding revision history,
 * rollback and revision deletion. Revisions are recorded by the controller;
 * rollback restores the binding spec of an earlier revision, which the
 * controller makes active again; deleting a revision removes it from the
 * history for good.
 */
export class ReleaseBindingRevisionService {
  private logger: LoggerService;
  private baseUrl: string;

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  /**
   * Returns every revision of the component's binding in one environment,
   * in the order the API returns them.
   */
  async listRevisions(
    request: {
      namespaceName: string;
      componentName: string;
      environment: string;
      /** Only this binding's revisions: a component has one per release line. */
      bindingName?: string;
    },
    token?: string,
  ): Promise<ReleaseBindingRevision[]> {
    this.logger.debug(
      `Listing release binding revisions for component: ${request.componentName}, environment: ${request.environment}`,
    );

    const client = createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token,
      logger: this.logger,
    });

    return readAllPages<ReleaseBindingRevision>(async cursor =>
      requireApiResponse(
        await client.GET(
          '/api/v1/namespaces/{namespaceName}/releasebindingrevisions',
          {
            params: {
              path: { namespaceName: request.namespaceName },
              query: {
                component: request.componentName,
                environment: request.environment,
                ...(request.bindingName
                  ? { binding: request.bindingName }
                  : {}),
                limit: PAGE_LIMIT,
                ...(cursor ? { cursor } : {}),
              },
            },
          },
        ),
        'list release binding revisions',
      ),
    );
  }

  /**
   * Returns every revision of the resource's binding in one environment,
   * in the order the API returns them.
   */
  async listResourceRevisions(
    request: {
      namespaceName: string;
      resourceName: string;
      environment: string;
      /** Only this binding's revisions: a component has one per release line. */
      bindingName?: string;
    },
    token?: string,
  ): Promise<ResourceReleaseBindingRevision[]> {
    this.logger.debug(
      `Listing resource release binding revisions for resource: ${request.resourceName}, environment: ${request.environment}`,
    );

    const client = createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token,
      logger: this.logger,
    });

    return readAllPages<ResourceReleaseBindingRevision>(async cursor =>
      requireApiResponse(
        await client.GET(
          '/api/v1/namespaces/{namespaceName}/resourcereleasebindingrevisions',
          {
            params: {
              path: { namespaceName: request.namespaceName },
              query: {
                resource: request.resourceName,
                environment: request.environment,
                ...(request.bindingName
                  ? { binding: request.bindingName }
                  : {}),
                limit: PAGE_LIMIT,
                ...(cursor ? { cursor } : {}),
              },
            },
          },
        ),
        'list resource release binding revisions',
      ),
    );
  }

  /**
   * Rolls a binding back to an earlier revision, or previews it when dryRun
   * is set. A 409 keeps the API's error code (RELEASE_DELETED or
   * CONCURRENT_MODIFICATION) on the thrown ConflictError, so the frontend
   * can tell the two apart.
   */
  async rollback(
    request: {
      namespaceName: string;
      bindingName: string;
      revision: number;
      dryRun: boolean;
      /** Optional reason for the rollback; only sent when given. */
      message?: string;
    },
    token?: string,
  ): Promise<RollbackResponse> {
    this.logger.info(
      `${
        request.dryRun ? 'Previewing' : 'Applying'
      } rollback of release binding: ${request.bindingName} to revision ${
        request.revision
      }`,
    );

    const client = createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token,
      logger: this.logger,
    });

    const { data, error, response } = await client.POST(
      '/api/v1/namespaces/{namespaceName}/releasebindings/{releaseBindingName}/rollback',
      {
        params: {
          path: {
            namespaceName: request.namespaceName,
            releaseBindingName: request.bindingName,
          },
        },
        body: {
          revision: request.revision,
          dryRun: request.dryRun,
          ...(request.message ? { message: request.message } : {}),
        },
      },
    );

    const conflict = conflictWithCode(
      response.status,
      error,
      'Rollback conflicts with the binding',
    );
    if (conflict) throw conflict;

    return requireApiResponse(
      { data, error, response },
      'roll back release binding',
    );
  }

  /**
   * Rolls a resource binding back to an earlier revision, or previews it
   * when dryRun is set. A 409 keeps the API's error code, as for rollback.
   */
  async rollbackResource(
    request: {
      namespaceName: string;
      bindingName: string;
      revision: number;
      dryRun: boolean;
      /** Optional reason for the rollback; only sent when given. */
      message?: string;
    },
    token?: string,
  ): Promise<RollbackResponse> {
    this.logger.info(
      `${
        request.dryRun ? 'Previewing' : 'Applying'
      } rollback of resource release binding: ${
        request.bindingName
      } to revision ${request.revision}`,
    );

    const client = createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token,
      logger: this.logger,
    });

    const { data, error, response } = await client.POST(
      '/api/v1/namespaces/{namespaceName}/resourcereleasebindings/{resourceReleaseBindingName}/rollback',
      {
        params: {
          path: {
            namespaceName: request.namespaceName,
            resourceReleaseBindingName: request.bindingName,
          },
        },
        body: {
          revision: request.revision,
          dryRun: request.dryRun,
          ...(request.message ? { message: request.message } : {}),
        },
      },
    );

    const conflict = conflictWithCode(
      response.status,
      error,
      'Rollback conflicts with the binding',
    );
    if (conflict) throw conflict;

    return requireApiResponse(
      { data, error, response },
      'roll back resource release binding',
    );
  }

  /**
   * Deletes one revision of a release binding, or with dryRun only checks
   * that it may be deleted. A 409 keeps the API's error code
   * (REVISION_PROTECTED or CONCURRENT_MODIFICATION) on the thrown
   * ConflictError.
   */
  async deleteRevision(
    request: {
      namespaceName: string;
      bindingName: string;
      revisionName: string;
      dryRun: boolean;
    },
    token?: string,
  ): Promise<DeleteBindingRevisionResponse> {
    this.logger.info(
      `${
        request.dryRun ? 'Checking deletion of' : 'Deleting'
      } release binding revision: ${request.revisionName}`,
    );

    const client = createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token,
      logger: this.logger,
    });

    const { data, error, response } = await client.DELETE(
      '/api/v1/namespaces/{namespaceName}/releasebindingrevisions/{releaseBindingRevisionName}',
      {
        params: {
          path: {
            namespaceName: request.namespaceName,
            releaseBindingRevisionName: request.revisionName,
          },
          query: { binding: request.bindingName, dryRun: request.dryRun },
        },
      },
    );

    const conflict = conflictWithCode(
      response.status,
      error,
      'The revision cannot be deleted',
    );
    if (conflict) throw conflict;

    return requireApiResponse(
      { data, error, response },
      'delete release binding revision',
    );
  }

  /**
   * Deletes one revision of a resource release binding, or with dryRun only
   * checks that it may be deleted. A 409 keeps the API's error code, as for
   * deleteRevision.
   */
  async deleteResourceRevision(
    request: {
      namespaceName: string;
      bindingName: string;
      revisionName: string;
      dryRun: boolean;
    },
    token?: string,
  ): Promise<DeleteBindingRevisionResponse> {
    this.logger.info(
      `${
        request.dryRun ? 'Checking deletion of' : 'Deleting'
      } resource release binding revision: ${request.revisionName}`,
    );

    const client = createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token,
      logger: this.logger,
    });

    const { data, error, response } = await client.DELETE(
      '/api/v1/namespaces/{namespaceName}/resourcereleasebindingrevisions/{resourceReleaseBindingRevisionName}',
      {
        params: {
          path: {
            namespaceName: request.namespaceName,
            resourceReleaseBindingRevisionName: request.revisionName,
          },
          query: { binding: request.bindingName, dryRun: request.dryRun },
        },
      },
    );

    const conflict = conflictWithCode(
      response.status,
      error,
      'The revision cannot be deleted',
    );
    if (conflict) throw conflict;

    return requireApiResponse(
      { data, error, response },
      'delete resource release binding revision',
    );
  }

  /**
   * Reads the revision history limit of a release binding, with its
   * Environment's limit for when the binding sets none.
   */
  async getHistoryLimit(
    request: { namespaceName: string; bindingName: string },
    token?: string,
  ): Promise<BindingRevisionHistoryLimit> {
    const client = createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token,
      logger: this.logger,
    });

    const { data, error, response } = await client.GET(
      '/api/v1/namespaces/{namespaceName}/releasebindings/{releaseBindingName}',
      {
        params: {
          path: {
            namespaceName: request.namespaceName,
            releaseBindingName: request.bindingName,
          },
        },
      },
    );
    const binding = requireApiResponse(
      { data, error, response },
      'fetch release binding',
    );

    return {
      bindingLimit: binding.spec?.revisionHistoryLimit ?? null,
      ...(await this.environmentHistoryLimit(
        request.namespaceName,
        binding.spec?.environment,
        token,
      )),
    };
  }

  /**
   * Sets the revision history limit of a release binding, or with a null
   * limit clears it so the Environment's applies. Changing the limit records
   * no revision; lowering it deletes the oldest revisions.
   */
  async setHistoryLimit(
    request: {
      namespaceName: string;
      bindingName: string;
      limit: number | null;
    },
    token?: string,
  ): Promise<BindingRevisionHistoryLimit> {
    this.logger.info(
      `Setting revision history limit of release binding ${
        request.bindingName
      } to ${request.limit ?? 'unset'}`,
    );

    const client = createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token,
      logger: this.logger,
    });
    const params = {
      path: {
        namespaceName: request.namespaceName,
        releaseBindingName: request.bindingName,
      },
    };

    const existing = await client.GET(
      '/api/v1/namespaces/{namespaceName}/releasebindings/{releaseBindingName}',
      { params },
    );
    const binding = requireApiResponse(existing, 'fetch release binding');
    if (!binding.spec) {
      throw new ConflictError(
        `Release binding ${request.bindingName} has no spec to update`,
      );
    }

    const { revisionHistoryLimit: _previous, ...spec } = binding.spec;
    const updated = await client.PUT(
      '/api/v1/namespaces/{namespaceName}/releasebindings/{releaseBindingName}',
      {
        params,
        body: {
          ...binding,
          spec: {
            ...spec,
            ...(request.limit === null
              ? {}
              : { revisionHistoryLimit: request.limit }),
          },
        },
      },
    );
    const conflict = conflictWithCode(
      updated.response.status,
      updated.error,
      'The binding changed while the history limit was being saved',
    );
    if (conflict) throw conflict;
    requireApiResponse(updated, 'update release binding');

    return {
      bindingLimit: request.limit,
      ...(await this.environmentHistoryLimit(
        request.namespaceName,
        binding.spec.environment,
        token,
      )),
    };
  }

  /**
   * Reads the revision history limit of a resource release binding, as
   * getHistoryLimit does for a release binding.
   */
  async getResourceHistoryLimit(
    request: { namespaceName: string; bindingName: string },
    token?: string,
  ): Promise<BindingRevisionHistoryLimit> {
    const client = createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token,
      logger: this.logger,
    });

    const { data, error, response } = await client.GET(
      '/api/v1/namespaces/{namespaceName}/resourcereleasebindings/{resourceReleaseBindingName}',
      {
        params: {
          path: {
            namespaceName: request.namespaceName,
            resourceReleaseBindingName: request.bindingName,
          },
        },
      },
    );
    const binding = requireApiResponse(
      { data, error, response },
      'fetch resource release binding',
    );

    return {
      bindingLimit: binding.spec?.revisionHistoryLimit ?? null,
      ...(await this.environmentHistoryLimit(
        request.namespaceName,
        binding.spec?.environment,
        token,
      )),
    };
  }

  /**
   * Sets or clears the revision history limit of a resource release binding,
   * as setHistoryLimit does for a release binding.
   */
  async setResourceHistoryLimit(
    request: {
      namespaceName: string;
      bindingName: string;
      limit: number | null;
    },
    token?: string,
  ): Promise<BindingRevisionHistoryLimit> {
    this.logger.info(
      `Setting revision history limit of resource release binding ${
        request.bindingName
      } to ${request.limit ?? 'unset'}`,
    );

    const client = createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token,
      logger: this.logger,
    });
    const params = {
      path: {
        namespaceName: request.namespaceName,
        resourceReleaseBindingName: request.bindingName,
      },
    };

    const existing = await client.GET(
      '/api/v1/namespaces/{namespaceName}/resourcereleasebindings/{resourceReleaseBindingName}',
      { params },
    );
    const binding = requireApiResponse(
      existing,
      'fetch resource release binding',
    );
    if (!binding.spec) {
      throw new ConflictError(
        `Resource release binding ${request.bindingName} has no spec to update`,
      );
    }

    const { revisionHistoryLimit: _previous, ...spec } = binding.spec;
    const updated = await client.PUT(
      '/api/v1/namespaces/{namespaceName}/resourcereleasebindings/{resourceReleaseBindingName}',
      {
        params,
        body: {
          ...binding,
          spec: {
            ...spec,
            ...(request.limit === null
              ? {}
              : { revisionHistoryLimit: request.limit }),
          },
        },
      },
    );
    const conflict = conflictWithCode(
      updated.response.status,
      updated.error,
      'The binding changed while the history limit was being saved',
    );
    if (conflict) throw conflict;
    requireApiResponse(updated, 'update resource release binding');

    return {
      bindingLimit: request.limit,
      ...(await this.environmentHistoryLimit(
        request.namespaceName,
        binding.spec.environment,
        token,
      )),
    };
  }

  /**
   * The Environment's spec.revisionHistoryLimit, null when it sets none. It is
   * only shown as the value a binding inherits, so an Environment that cannot
   * be read does not fail the request: it is reported as unreadable instead,
   * so the portal does not mistake it for one that sets no limit.
   */
  private async environmentHistoryLimit(
    namespaceName: string,
    environment: string | undefined,
    token?: string,
  ): Promise<
    Pick<
      BindingRevisionHistoryLimit,
      'environmentLimit' | 'environmentLimitUnreadable'
    >
  > {
    const unreadable = {
      environmentLimit: null,
      environmentLimitUnreadable: true,
    };
    if (!environment) return unreadable;
    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });
      const { data, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/environments/{envName}',
        { params: { path: { namespaceName, envName: environment } } },
      );
      if (!response.ok) return unreadable;
      return { environmentLimit: data?.spec?.revisionHistoryLimit ?? null };
    } catch (err) {
      this.logger.debug(
        `Could not read environment ${environment} for its revision history limit: ${err}`,
      );
      return unreadable;
    }
  }
}
