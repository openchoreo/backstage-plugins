# OpenChoreo API Migration Guide

## 1. Overview & Motivation

OpenChoreo is cleaning up its REST API before the 1.0 release. The key changes:

- **K8s-style resource descriptors**: Resource CRUD endpoints now send/receive full `{ metadata, spec, status }` objects instead of flat field objects.
- **Dedicated CRUD endpoints**: The generic `/apply` and `/delete` endpoints are replaced by per-resource CRUD (e.g., `GET/PUT/DELETE /environments/{name}`).
- **Flattened URL hierarchy**: Components are no longer nested under projects (e.g., `/components/{name}` instead of `/projects/{p}/components/{c}`).
- **Cursor-based pagination**: Replaces offset-based pagination with `{ items, pagination: { nextCursor, remainingCount } }`.
- **API version routing header**: Legacy and new API coexist, routed via a request header (`X-OpenChoreo-API-Version`).

Both APIs will coexist until the new API is feature-complete. The `openchoreo.useNewApi` config flag controls which API path is used.

## 2. Architecture & Naming

| Concept               | Name                                | Description                                |
| --------------------- | ----------------------------------- | ------------------------------------------ |
| New API types         | `openchoreo`                        | The real 1.0 API (K8s-style resources)     |
| Legacy API types      | `openchoreo-legacy`                 | Pre-1.0 API (flat responses, generic CRUD) |
| New client factory    | `createOpenChoreoApiClient()`       | Uses new API types + routing header        |
| Legacy client factory | `createOpenChoreoLegacyApiClient()` | Uses legacy API types (no header)          |
| Config flag           | `openchoreo.useNewApi`              | Controls which API path BFF services use   |

**No rename needed later** -- when the legacy API is removed, `openchoreo` stays as-is.

### Generated Types

```typescript
// New API types (K8s-style: metadata/spec/status)
import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
type Project = OpenChoreoComponents['schemas']['Project'];

// Legacy API types (flat responses)
import type { OpenChoreoLegacyComponents } from '@openchoreo/openchoreo-client-node';
type ProjectResponse = OpenChoreoLegacyComponents['schemas']['ProjectResponse'];
```

### OpenAPI Specs

| Spec file                                   | Config name         | Description                   |
| ------------------------------------------- | ------------------- | ----------------------------- |
| `openapi/openchoreo-api-legacy.yaml`        | `openchoreo-legacy` | Legacy/pre-1.0 API            |
| `openapi/openchoreo-api.yaml`               | `openchoreo`        | New 1.0 API                   |
| `openapi/openchoreo-observability-api.yaml` | `observability`     | Observability API (unchanged) |
| `openapi/openchoreo-ai-rca-agent.yaml`      | `ai-rca-agent`      | AI RCA Agent API (unchanged)  |

## 3. Patterns for BFF Service Migration

### Service Constructor

```typescript
class MyInfoService {
  constructor(
    private readonly baseUrl: string,
    private readonly useNewApi: boolean,
    private readonly logger: LoggerService,
  ) {}
}
```

### Method Pattern

Each service method branches based on the `useNewApi` flag:

```typescript
async fetchItems(namespaceName: string, token?: string): Promise<ItemResponse[]> {
  if (this.useNewApi) {
    return this.fetchItemsNew(namespaceName, token);
  }
  return this.fetchItemsLegacy(namespaceName, token);
}

private async fetchItemsLegacy(namespaceName: string, token?: string) {
  const client = createOpenChoreoLegacyApiClient({
    baseUrl: this.baseUrl, token, logger: this.logger,
  });
  const { data, error } = await client.GET('/namespaces/{namespaceName}/items', {
    params: { path: { namespaceName } },
  });
  if (error) throw new Error('Failed to fetch items');
  return data.data.items;
}

private async fetchItemsNew(namespaceName: string, token?: string) {
  const client = createOpenChoreoApiClient({
    baseUrl: this.baseUrl, token, logger: this.logger,
  });
  const allItems = await fetchAllPages(cursor =>
    client.GET('/api/v1/namespaces/{namespaceName}/items', {
      params: { path: { namespaceName }, query: { limit: 100, cursor } },
    }).then(res => {
      if (res.error) throw new Error('Failed to fetch items');
      return res.data;
    }),
  );
  // Transform K8s-style resources to legacy response shape
  return allItems.map(transformItem);
}
```

### Transformers

BFF must continue returning the same response shape to the frontend. Transformers convert K8s-style responses to legacy flat shapes:

```typescript
// transformers/project.ts
function transformProject(project: Project): ProjectResponse {
  return {
    uid: getUid(project),
    name: getName(project),
    displayName: getDisplayName(project),
    // ... map spec/status fields to flat response
  };
}
```

The frontend remains unaware of which API version is in use.

## 4. Pagination Pattern

### Legacy (offset-based)

```
GET /namespaces/{ns}/items?page=1&pageSize=100
Response: { success: true, data: { items, totalCount, page, pageSize } }
```

### New (cursor-based)

```
GET /api/v1/namespaces/{ns}/items?limit=100&cursor=...
Response: { items, pagination: { nextCursor, remainingCount } }
```

### `fetchAllPages()` Helper

Use when all items are needed (catalog provider, BFF services):

```typescript
import { fetchAllPages } from '@openchoreo/openchoreo-client-node';

const allProjects = await fetchAllPages(cursor =>
  client
    .GET('/api/v1/namespaces/{ns}/projects', {
      params: { path: { ns: 'my-ns' }, query: { limit: 100, cursor } },
    })
    .then(res => {
      if (res.error) throw new Error('Failed to fetch');
      return res.data;
    }),
);
```

### BFF Routes with Frontend Pagination

For BFF routes that expose pagination to the frontend, translate offset params to cursor internally during the transition. Eventually the frontend will migrate to cursor-based.

## 5. Resource Utility Functions

Import from `@openchoreo/openchoreo-client-node`:

```typescript
import {
  getName,
  getNamespace,
  getUid,
  getCreatedAt,
  getLabels,
  getAnnotations,
  getLabel,
  getAnnotation,
  getDisplayName,
  getDescription,
  getConditions,
  getCondition,
  getConditionStatus,
  isReady,
} from '@openchoreo/openchoreo-client-node';
```

### Examples

```typescript
const project: Project = { metadata: { name: 'my-project', ... }, spec: { ... }, status: { ... } };

getName(project);            // 'my-project'
getUid(project);             // '550e8400-...'
isReady(project);            // true (if Ready condition status is 'True')
getDisplayName(project);     // checks annotation, falls back to name
getCondition(project, 'Ready'); // { type: 'Ready', status: 'True', ... }
```

## 6. Catalog Provider Specifics

- Fetches all resources via `fetchAllPages()` with `limit=100`
- Workloads are a separate resource in the new API -- fetch per namespace, match to components client-side
- Entity translation functions accept K8s-style types and use resource-utils

## 7. Assumptions

- Legacy and new API share the same base URL, differentiated by the `X-OpenChoreo-API-Version` header
- New API will have full CRUD for all resource types before 1.0 (component-types, traits, component-workflows currently WIP)
- List endpoints return full resource descriptors (metadata + spec + status) -- no summary/lightweight list mode
- The new API response is NOT wrapped in `{ success, data }` -- resources are returned directly
- Error responses use `{ error, code, details }` format

## 8. Cleanup Guide (Post-Migration)

When the new API is feature-complete and stable:

1. Set `openchoreo.useNewApi: true` as default
2. Test thoroughly with legacy API disabled
3. Remove `useNewApi` flags from all services (delete legacy branches)
4. Delete `openapi/openchoreo-api-legacy.yaml` and `src/generated/openchoreo-legacy/`
5. Remove `createOpenChoreoLegacyApiClient` from factory.ts
6. Remove all `openchoreo-legacy` imports across the codebase
7. Remove the `PlatformResourceService` generic CRUD code (`/apply`, `/delete`, `/resources/{kind}/{name}`)
8. Remove the routing header from the client factory (no longer needed when legacy is gone)
9. Clean up transformer layer if frontend is updated to accept K8s-style types directly (optional, separate effort)
10. Update `openapi-config.json` to remove the legacy spec entry

## 9. How to Add a New Resource Type

Step-by-step for adding a new resource (e.g., when OpenChoreo adds a new CRD):

1. Update `openapi/openchoreo-api.yaml` with the new endpoints and schemas
2. Run `yarn generate:clients` to regenerate types
3. Create a transformer in `transformers/` if BFF needs to serve legacy-shaped responses
4. Add/update BFF service methods
5. Add integration tests
6. Update catalog provider if the resource should appear in the Backstage catalog

## Key Open Items (TBD with OpenChoreo team)

- [ ] API version routing header name (placeholder: `X-OpenChoreo-API-Version`)
- [ ] Where `displayName` and `description` live in K8s-style resources (annotations? labels? dedicated fields?)
- [ ] Confirm Workload resource includes endpoint info needed for API entity creation
- [ ] Confirm list endpoints support `limit=100` or higher for efficient batch fetching
