# OpenChoreo Incremental Provider

The OpenChoreo Incremental Provider processes entities in small batches using cursor-based pagination with burst and rest cycles, providing optimal memory consumption, scalability, and controlled load for large OpenChoreo installations.

## Installation

Add the incremental provider module to your backend:

```typescript
// packages/backend/src/index.ts
backend.add(
  import('@openchoreo/plugin-catalog-backend-module-openchoreo-incremental'),
);
```

## Configuration

```yaml
openchoreo:
  baseUrl: ${OPENCHOREO_API_URL}
  token: ${OPENCHOREO_TOKEN}
  incremental:
    burstLength: 10 # seconds - duration of each processing burst
    burstInterval: 30 # seconds - interval between bursts during active ingestion
    restLength: 30 # minutes - rest period after completing full ingestion
    chunkSize: 50 # entities per API request
```

## How It Works

### Burst-Based Processing

The provider uses a burst-and-rest cycle to control load:

1. **Burst Phase**: Processes entities continuously for `burstLength` seconds
2. **Interstitial Phase**: Pauses for `burstInterval` seconds between bursts
3. **Rest Phase**: After completing a full ingestion cycle, rests for `restLength` minutes before starting again

This approach prevents overwhelming the API server while ensuring regular catalog updates.

### Cursor-Based Pagination

The provider traverses OpenChoreo resources in three phases using cursor-based pagination:

1. **Organizations Phase**: Fetches all organizations and builds an organization queue
2. **Projects Phase**: For each organization, fetches all projects and builds a project queue
3. **Components Phase**: For each project, fetches all components and their APIs

Each phase maintains its own API cursor (`orgApiCursor`, `projectApiCursor`, `componentApiCursor`) allowing safe resumption after interruptions. The cursor state tracks:

- Current phase (`orgs`, `projects`, `components`)
- API pagination cursors for each resource type
- Queues of organizations and projects to process
- Current position in each queue

### Requirements

Your OpenChoreo backend must support cursor-based pagination. The provider validates cursor support at startup and will throw an error if the API does not return the required `nextCursor` field in pagination responses.

### State Persistence

All ingestion state is persisted to the database:

- Cursors are saved after each burst
- Entity references are tracked for staleness detection
- Progress can resume from the last successful checkpoint
- Removed entities are detected by comparing current and previous ingestion snapshots

## Management API

The module provides REST API endpoints for monitoring and managing incremental ingestion:

- `GET /api/catalog/incremental/health` - Health check status for all providers
- `GET /api/catalog/incremental/providers` - List all registered incremental providers
- `GET /api/catalog/incremental/providers/{name}/status` - Get detailed status for a specific provider
- `POST /api/catalog/incremental/providers/{name}/reset` - Reset provider state to start fresh ingestion
- `POST /api/catalog/incremental/providers/{name}/refresh` - Trigger immediate refresh of provider data

## Database Migrations

The module includes automatic database migrations to create the necessary tables for state persistence:

- `openchoreo_incremental_ingestion_state` - Stores cursor state and ingestion metadata
- `openchoreo_incremental_entity_refs` - Tracks entity references for staleness detection

These migrations run automatically when the module is first loaded.

## Migration from Legacy Provider

If you were previously using the basic `catalog-backend-module-openchoreo` provider:

1. **Remove the old provider**: Remove the basic OpenChoreo provider module from your backend
2. **Add this incremental module**: Register this module as shown in the Installation section
3. **Update configuration**: Add the `incremental` configuration block (or use defaults)
4. **Verify API support**: Ensure your OpenChoreo API supports cursor-based pagination endpoints

## Extension Points

The module provides extension points for advanced use cases:

### Incremental Provider Extension Point

You can extend the module with custom incremental entity providers:

```typescript
import { 
  openchoreoIncrementalProvidersExtensionPoint,
  type OpenChoreoIncrementalProviderExtensionPoint 
} from '@openchoreo/plugin-catalog-backend-module-openchoreo-incremental';

// In your backend module
export default createBackendModule({
  pluginId: 'catalog',
  moduleId: 'custom-incremental-provider',
  register(env) {
    env.registerInit({
      deps: {
        providers: openchoreoIncrementalProvidersExtensionPoint,
      },
      async init({ providers }) {
        providers.addIncrementalEntityProvider(new CustomIncrementalProvider());
      },
    });
  },
});
```

### Custom Provider Implementation

Implement the `IncrementalEntityProvider` interface for custom providers:

```typescript
import { IncrementalEntityProvider, EntityIteratorResult } from '@openchoreo/plugin-catalog-backend-module-openchoreo-incremental';

class CustomIncrementalProvider implements IncrementalEntityProvider<MyCursor, MyContext> {
  getProviderName(): string { return 'custom-provider'; }
  
  async around(burst: (context: MyContext) => Promise<void>): Promise<void> {
    // Setup and teardown logic
    await burst(context);
  }
  
  async next(context: MyContext, cursor?: MyCursor): Promise<EntityIteratorResult<MyCursor>> {
    // Return batch of entities and next cursor
  }
}
```

## Features

- **Burst-Based Processing**: Controlled load with configurable burst and rest cycles
- **Three-Phase Traversal**: Systematic ingestion of organizations → projects → components
- **Cursor-Based Pagination**: Stable API cursors for efficient, resumable pagination
- **Memory Efficient**: Processes entities in small chunks without loading large datasets
- **Scalable**: Handles very large datasets efficiently with constant memory usage
- **Fault Tolerant**: Resumes from last successful checkpoint after interruptions
- **Configurable**: Customizable burst intervals, rest periods, chunk sizes, and retry backoff
- **Error Resilient**: Exponential backoff strategy with configurable retry intervals
- **Staleness Detection**: Automatically removes entities that no longer exist in OpenChoreo
- **Metrics & Observability**: OpenTelemetry metrics for monitoring ingestion progress
- **Event-Driven Updates**: Supports delta updates via Backstage events system
- **Management API**: REST endpoints for monitoring and controlling ingestion processes
- **Database Persistence**: Automatic migrations and state management
- **Extension Points**: Pluggable architecture for custom incremental providers
- **Health Monitoring**: Built-in health checks and provider status reporting
