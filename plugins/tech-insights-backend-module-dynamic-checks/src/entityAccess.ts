import express from 'express';
import Router from 'express-promise-router';
import type {
  BackstageCredentials,
  HttpAuthService,
  PermissionsService,
} from '@backstage/backend-plugin-api';
import { parseEntityRef, stringifyEntityRef } from '@backstage/catalog-model';
import { InputError, NotAllowedError } from '@backstage/errors';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import type { CatalogService } from '@backstage/plugin-catalog-node';
import { dynamicCheckReadPermission } from '@openchoreo/backstage-plugin-tech-insights-dynamic-checks-common';

interface EntityAccessGateOptions {
  catalog: CatalogService;
  httpAuth: HttpAuthService;
  permissions: PermissionsService;
}

/**
 * Parses a ref the way the upstream route does, then lowercases it, since the
 * catalog's batch lookup matches stored refs, which are lowercase.
 */
function toCatalogRef(ref: unknown): string {
  try {
    return stringifyEntityRef(
      parseEntityRef(ref as Parameters<typeof parseEntityRef>[0]),
    ).toLocaleLowerCase('en-US');
  } catch {
    throw new InputError(`"${String(ref)}" isn't a valid entity ref.`);
  }
}

/**
 * Upstream tech-insights routes that return an entity's facts or check
 * results check only tech-insights permissions, not whether the caller can
 * see the entity. This router runs ahead of them, because a module's routes
 * are mounted before its host plugin's, and passes a request on only when the
 * caller can read every entity it names in the catalog.
 *
 * The bulk run backs the platform-wide overview, so holders of the dynamic
 * check read permission may run it for any entities.
 */
export function createEntityAccessGate(
  options: EntityAccessGateOptions,
): express.Router {
  const { catalog, httpAuth, permissions } = options;
  const router = Router();

  async function requireReadable(
    credentials: BackstageCredentials,
    entityRefs: string[],
  ) {
    const { items } = await catalog.getEntitiesByRefs(
      { entityRefs, fields: ['kind'] },
      { credentials },
    );
    // Missing and hidden entities get the same answer, so the response
    // doesn't tell a caller which entities exist.
    if (items.some(item => !item)) {
      throw new NotAllowedError("You don't have access to that entity.");
    }
  }

  router.post('/checks/run/:namespace/:kind/:name', async (req, _res, next) => {
    const { namespace, kind, name } = req.params;
    await requireReadable(await httpAuth.credentials(req), [
      toCatalogRef({ namespace, kind, name }),
    ]);
    next();
  });

  for (const path of ['/facts/latest', '/facts/range']) {
    router.get(path, async (req, _res, next) => {
      await requireReadable(await httpAuth.credentials(req), [
        toCatalogRef(req.query.entity),
      ]);
      next();
    });
  }

  router.post('/checks/run', express.json(), async (req, _res, next) => {
    const credentials = await httpAuth.credentials(req);
    const [decision] = await permissions.authorize(
      [{ permission: dynamicCheckReadPermission }],
      { credentials },
    );
    if (decision.result === AuthorizeResult.ALLOW) {
      next();
      return;
    }
    const entities: unknown = req.body?.entities;
    // Upstream runs an empty list against every entity with facts.
    if (!Array.isArray(entities) || entities.length === 0) {
      throw new NotAllowedError(
        `Running checks for every entity needs the ${dynamicCheckReadPermission.name} permission.`,
      );
    }
    await requireReadable(credentials, entities.map(toCatalogRef));
    next();
  });

  return router;
}
