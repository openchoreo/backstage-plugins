import {
  AuthService,
  HttpAuthService,
  LoggerService,
} from '@backstage/backend-plugin-api';
import { CatalogService } from '@backstage/plugin-catalog-node';
import {
  OpenChoreoTokenService,
  createUserTokenMiddleware,
  getUserTokenFromRequest,
} from '@openchoreo/openchoreo-auth';
import { OPENCHOREO_PERMISSION_TO_ACTION } from '@openchoreo/backstage-plugin-common';
import express from 'express';
import Router from 'express-promise-router';
import { AuthzProfileService } from './services';
import { isConstrained, resolveCapability } from './utils/capabilityLookup';
import {
  entityToCapabilityPath,
  getEntityScope,
  scopeToCapabilityPath,
} from './utils/entityScope';
import {
  matchesScope,
  NAMESPACE_SCOPED_KINDS,
} from './rules/matchesCapability';

// Parses an optional `{ name, kind? }` request-body field used for ABAC
// attributes like `workflow` and `componentType`. Returns undefined when the
// input is missing or malformed.
function parseDualScopedAttr(
  value: unknown,
): { name: string; kind?: string } | undefined {
  if (
    !value ||
    typeof value !== 'object' ||
    typeof (value as { name?: unknown }).name !== 'string' ||
    (value as { name: string }).name.length === 0
  ) {
    return undefined;
  }
  const v = value as { name: string; kind?: unknown };
  const kind =
    typeof v.kind === 'string' && v.kind.length > 0 ? v.kind : undefined;
  return { name: v.name, kind };
}

/**
 * Router options for the OpenChoreo permission policy module.
 */
export interface RouterOptions {
  /** The authz profile service for fetching and caching capabilities */
  authzService: AuthzProfileService;
  /** Logger service */
  logger: LoggerService;
  /** Auth service for service-to-service tokens (used to read entities) */
  auth: AuthService;
  /** HTTP auth service for authenticating incoming requests */
  httpAuth: HttpAuthService;
  /** Catalog client used to resolve resourceRef → entity */
  catalogService: CatalogService;
  /** Token service for extracting the user's OpenChoreo IDP token */
  tokenService: OpenChoreoTokenService;
}

/**
 * Creates the router for the OpenChoreo permission policy module.
 *
 * Exposes:
 * - POST /cache-capabilities — sign-in pre-cache hook
 * - POST /evaluate-with-context — env-aware permission check used by the
 *   frontend permission hooks to honor ABAC CEL constraints (issue #3407).
 */
export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { authzService, logger, auth, httpAuth, catalogService, tokenService } =
    options;

  const router = Router();

  // Extract the OpenChoreo IDP token from request headers; downstream
  // handlers retrieve it via getUserTokenFromRequest().
  router.use(createUserTokenMiddleware(tokenService));

  /**
   * POST /cache-capabilities
   *
   * Pre-caches user capabilities. Called by the auth module after successful sign-in
   * to ensure capabilities are available for permission checks.
   *
   * Request body:
   * - userEntityRef: string - The user's entity reference (e.g., "user:default/email@example.com")
   * - accessToken: string - The user's OpenChoreo IDP token
   *
   * Response:
   * - 200: { success: true }
   * - 400: { error: "Missing userEntityRef or accessToken" }
   * - 500: { error: "Failed to cache capabilities" }
   */
  router.post('/cache-capabilities', express.json(), async (req, res) => {
    const { userEntityRef, accessToken } = req.body;

    if (!userEntityRef || typeof userEntityRef !== 'string') {
      return res
        .status(400)
        .json({ error: 'Missing or invalid userEntityRef' });
    }

    if (!accessToken || typeof accessToken !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid accessToken' });
    }

    try {
      await authzService.preCacheCapabilities(userEntityRef, accessToken);
      logger.info(`Pre-cached capabilities for ${userEntityRef}`);
      return res.status(200).json({ success: true });
    } catch (error) {
      logger.error(
        `Failed to pre-cache capabilities for ${userEntityRef}`,
        error as Error,
      );
      return res.status(500).json({ error: 'Failed to cache capabilities' });
    }
  });

  /**
   * POST /evaluate-with-context
   *
   * Context-aware permission check. Used by frontend permission hooks
   * (useDeployPermission, useLogsPermission, useBuildPermission, …) to honor
   * ABAC CEL constraints scoped to `resource.environment` and/or
   * `resource.workflow`.
   *
   * Decision flow for the resolved capability (with wildcard fallback):
   *   1. If any deny entry matches the entity's scope → DENY.
   *   2. If any unconstrained allow entry matches → ALLOW (fast path, no
   *      network round-trip).
   *   3. Otherwise, for each constrained allow that matches by path, call
   *      /api/v1/authz/evaluates with `context.resource.environment` and
   *      ALLOW if any decision is true. Cached in AuthzProfileCache so a
   *      page that renders many buttons hits the cache after the first call.
   *
   * Request body — caller must supply EITHER `resourceRef` OR `namespace`:
   *   - permissionName: string  (e.g. "openchoreo.releasebinding.create")
   *   - resourceRef?: string    (Backstage entity ref — scope derived from
   *                              the entity's annotations)
   *   - namespace?: string      (raw scope — used when no entity exists yet,
   *                              e.g. the scaffolder form before create)
   *   - project?:   string      (only valid alongside `namespace`)
   *   - environment?: string    (e.g. "dev")
   *   - workflow?: { name: string; kind?: string }
   *   - componentType?: { name: string; kind?: string }
   *   - resourceType?: { name: string; kind?: string }
   *
   * Response:
   *   - 200: { allowed: boolean }
   *   - 400: { error: ... }
   */
  router.post('/evaluate-with-context', express.json(), async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const userEntityRef = credentials.principal.userEntityRef;

    const {
      permissionName,
      resourceRef,
      namespace,
      project,
      environment,
      workflow,
      componentType,
      resourceType,
    } = req.body ?? {};
    if (typeof permissionName !== 'string' || !permissionName) {
      return res
        .status(400)
        .json({ error: 'Missing or invalid permissionName' });
    }
    // Caller picks one of two ways to describe the scope: an entity ref
    // or rawm namespace/project
    const hasResourceRef =
      typeof resourceRef === 'string' && resourceRef.length > 0;
    const hasNamespace = typeof namespace === 'string' && namespace.length > 0;
    if (!hasResourceRef && !hasNamespace) {
      return res
        .status(400)
        .json({ error: 'Must supply either resourceRef or namespace' });
    }

    const envValue =
      typeof environment === 'string' && environment.length > 0
        ? environment
        : undefined;
    const workflowValue = parseDualScopedAttr(workflow);
    const componentTypeValue = parseDualScopedAttr(componentType);
    const resourceTypeValue = parseDualScopedAttr(resourceType);

    const action = OPENCHOREO_PERMISSION_TO_ACTION[permissionName];
    if (!action) {
      return res
        .status(400)
        .json({ error: `Unknown OpenChoreo permission: ${permissionName}` });
    }

    // Resolve scope and capability path from either an entity ref (existing
    // resource flow) or raw fields (create flow, before any entity exists).
    let scope: { namespace?: string; project?: string; component?: string };
    let namespaceOnly: boolean;
    let entityPath: string | undefined;

    if (hasResourceRef) {
      // Use a service token so the lookup works regardless of catalog
      // visibility policies. Malformed refs surface as InputError → 400.
      const serviceCredentials = await auth.getOwnServiceCredentials();
      let entity;
      try {
        entity = await catalogService.getEntityByRef(resourceRef, {
          credentials: serviceCredentials,
        });
      } catch (err) {
        const errName = (err as Error)?.name;
        if (errName === 'InputError') {
          return res
            .status(400)
            .json({ error: `Invalid resourceRef: ${resourceRef}` });
        }
        logger.error(
          `Failed to resolve resourceRef=${resourceRef}`,
          err as Error,
        );
        return res.status(500).json({ error: 'Failed to resolve resourceRef' });
      }
      if (!entity) {
        return res
          .status(404)
          .json({ error: `Entity not found: ${resourceRef}` });
      }
      scope = getEntityScope(entity);
      namespaceOnly = NAMESPACE_SCOPED_KINDS.has(entity.kind.toLowerCase());
      entityPath = entityToCapabilityPath(entity);
    } else {
      const projectValue =
        typeof project === 'string' && project.length > 0 ? project : undefined;
      scope = { namespace, project: projectValue };
      const resourceKind = action.split(':')[0];
      namespaceOnly = NAMESPACE_SCOPED_KINDS.has(resourceKind);
      entityPath = scopeToCapabilityPath(namespace, projectValue);
    }

    if (!scope.namespace) {
      // Unknown scope — same default as matchesCapability rule.
      return res.status(200).json({ allowed: false });
    }

    const userToken = getUserTokenFromRequest(req);

    let capabilities;
    try {
      capabilities = await authzService.getCapabilitiesForUser(
        userEntityRef,
        userToken,
      );
    } catch (err) {
      logger.error(
        `Failed to fetch capabilities for ${userEntityRef}`,
        err as Error,
      );
      return res.status(500).json({ error: 'Failed to fetch capabilities' });
    }

    const actionCapability = resolveCapability(
      capabilities.capabilities,
      action,
    );
    if (!actionCapability) {
      return res.status(200).json({ allowed: false });
    }

    // Partition allowed/denied entries that match the entity's scope into
    // unconstrained (RBAC-only) and ABAC-gated buckets. Unconstrained entries
    // give a definitive answer locally; gated entries require a CEL
    // evaluation by the backend.
    const matchingAllows = (actionCapability.allowed ?? []).filter(
      e => e.path && matchesScope(e.path, scope, namespaceOnly),
    );
    const matchingDenies = (actionCapability.denied ?? []).filter(
      e => e.path && matchesScope(e.path, scope, namespaceOnly),
    );

    const hasUnconstrainedDeny = matchingDenies.some(e => !isConstrained(e));
    const hasUnconstrainedAllow = matchingAllows.some(e => !isConstrained(e));
    const hasConstrainedDeny = matchingDenies.some(e => isConstrained(e));
    const hasConstrainedAllow = matchingAllows.some(e => isConstrained(e));

    // 1. Absolute denies short-circuit. (RBAC always wins for unconstrained.)
    if (hasUnconstrainedDeny) {
      return res.status(200).json({ allowed: false });
    }

    // 2. Absolute allows short-circuit when there is no ABAC-gated deny that
    //    could revoke them.
    if (hasUnconstrainedAllow && !hasConstrainedDeny) {
      return res.status(200).json({ allowed: true });
    }

    // 3. No matching grant at all — DENY.
    if (!hasUnconstrainedAllow && !hasConstrainedAllow) {
      return res.status(200).json({ allowed: false });
    }

    // 4. CEL-gated grants and/or gated denies remain — defer to the backend
    //    evaluator, which honors the full allow/deny semantics including
    //    CEL conditions. Single call is sufficient (backend factors in all
    //    bindings for the action/path/env).
    if (!entityPath) {
      return res.status(200).json({ allowed: false });
    }
    try {
      const decisions = await authzService.evaluate(userToken, userEntityRef, [
        {
          action,
          resourcePath: entityPath,
          environment: envValue,
          workflow: workflowValue,
          componentType: componentTypeValue,
          resourceType: resourceTypeValue,
        },
      ]);
      return res.status(200).json({ allowed: decisions[0] === true });
    } catch (err) {
      logger.error(
        `evaluate-with-context failed for ${userEntityRef} action=${action}`,
        err as Error,
      );
      return res.status(200).json({ allowed: false });
    }
  });

  return router;
}
