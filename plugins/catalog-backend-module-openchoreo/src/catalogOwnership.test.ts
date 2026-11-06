import {
  coreServices,
  createBackendPlugin,
  createServiceFactory,
} from '@backstage/backend-plugin-api';
import { mockServices, startTestBackend } from '@backstage/backend-test-utils';
import { Entity } from '@backstage/catalog-model';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import {
  eventsServiceFactory,
  eventsServiceRef,
} from '@backstage/plugin-events-node';
import catalogPlugin from '@backstage/plugin-catalog-backend';
import {
  catalogModuleOpenchoreo,
  immediateCatalogServiceFactory,
} from './module';
import { OpenChoreoEntityProvider } from './provider/OpenChoreoEntityProvider';
import { immediateCatalogServiceRef } from './service/ImmediateCatalogService';
import { annotationStoreRef } from './service/AnnotationStore';

// End-to-end checks against the real catalog backend and database: an entity
// written through ImmediateCatalogService must be removed by the provider's
// full sync and delete events once it no longer exists in OpenChoreo
// (openchoreo/openchoreo#4993).

const mockGET = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({ GET: mockGET })),
  fetchAllPages: jest.fn((fetchPage: (cursor?: string) => Promise<any>) =>
    fetchPage(undefined).then((page: any) => page.items ?? []),
  ),
}));

const entityRef = 'environment:test-ns/repro';

const portalEnvironment: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Environment',
  metadata: {
    name: 'repro',
    namespace: 'test-ns',
    annotations: {
      'backstage.io/managed-by-location': 'provider:OpenChoreoEntityProvider',
      'backstage.io/managed-by-origin-location':
        'provider:OpenChoreoEntityProvider',
    },
  },
  spec: { type: 'development' },
};

async function waitFor<T>(
  probe: () => Promise<T>,
  done: (value: T) => boolean,
): Promise<T> {
  const deadline = Date.now() + 20_000;
  for (;;) {
    const value = await probe();
    if (done(value) || Date.now() > deadline) {
      return value;
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

/**
 * Starts the catalog with this module, and a stand-in for the scaffolder:
 * a separate plugin that consumes ImmediateCatalogService.
 */
async function startCatalog(options: { eventsEnabled: boolean }) {
  // Both call through; used to reach the provider the module registered and
  // to see when it runs a full sync.
  const connectSpy = jest.spyOn(OpenChoreoEntityProvider.prototype, 'connect');
  const runSpy = jest.spyOn(OpenChoreoEntityProvider.prototype, 'run');

  let scaffolder: any;
  const backend = await startTestBackend({
    features: [
      catalogPlugin,
      catalogModuleOpenchoreo,
      // The real in-process bus, so events published by one plugin reach
      // subscribers in another.
      eventsServiceFactory,
      immediateCatalogServiceFactory,
      createServiceFactory({
        service: annotationStoreRef,
        deps: {},
        factory: () => ({ getAnnotations: async () => ({}) } as any),
      }),
      createBackendPlugin({
        pluginId: 'scaffolder',
        register(env) {
          env.registerInit({
            deps: {
              immediateCatalog: immediateCatalogServiceRef,
              catalog: catalogServiceRef,
              events: eventsServiceRef,
              auth: coreServices.auth,
            },
            async init(deps) {
              scaffolder = deps;
            },
          });
        },
      }),
      mockServices.rootConfig.factory({
        data: {
          openchoreo: {
            baseUrl: 'http://openchoreo.test',
            events: { enabled: options.eventsEnabled },
            features: { auth: { enabled: false } },
          },
        },
      }),
    ],
  });

  // Let a sync triggered at startup finish before the test acts, so it
  // cannot be what removes the entity.
  await new Promise(resolve => setTimeout(resolve, 500));
  await Promise.all(runSpy.mock.results.map(r => r.value));

  return {
    backend,
    provider: () => connectSpy.mock.contexts[0] as OpenChoreoEntityProvider,
    fullSyncs: () => runSpy.mock.calls.length,
    insert: (entity: Entity) =>
      scaffolder.immediateCatalog.insertEntity(entity),
    read: async (): Promise<Entity | undefined> =>
      scaffolder.catalog.getEntityByRef(entityRef, {
        credentials: await scaffolder.auth.getOwnServiceCredentials(),
      }),
    publish: (topic: string, eventPayload: unknown) =>
      scaffolder.events.publish({ topic, eventPayload }),
  };
}

describe('catalog ownership of immediately inserted entities', () => {
  jest.setTimeout(60_000);

  beforeEach(() => {
    jest.restoreAllMocks();
    // OpenChoreo has no resources: the Environment was deleted before the
    // next sync could pick it up. Single-resource lookups return 404.
    mockGET.mockImplementation(async (path: string) =>
      path.includes('{envName}')
        ? {
            data: undefined,
            error: undefined,
            response: { ok: false, status: 404 },
          }
        : {
            data: { items: [] },
            error: undefined,
            response: { ok: true, status: 200 },
          },
    );
  });

  it('removes a portal-created entity on the next full sync once it is gone from OpenChoreo', async () => {
    const catalog = await startCatalog({ eventsEnabled: false });
    try {
      await catalog.insert(portalEnvironment);
      expect(await waitFor(catalog.read, e => e !== undefined)).toBeDefined();

      await catalog.provider().run();

      expect(await waitFor(catalog.read, e => e === undefined)).toBeUndefined();
    } finally {
      await catalog.backend.stop();
    }
  });

  it('removes a portal-created entity when its OpenChoreo delete event arrives', async () => {
    const catalog = await startCatalog({ eventsEnabled: true });
    try {
      await catalog.insert(portalEnvironment);
      expect(await waitFor(catalog.read, e => e !== undefined)).toBeDefined();
      const syncsBefore = catalog.fullSyncs();

      await catalog.publish('openchoreo.environment', {
        kind: 'Environment',
        name: 'repro',
        namespace: 'test-ns',
        action: 'deleted',
      });

      expect(await waitFor(catalog.read, e => e === undefined)).toBeUndefined();
      // Removed by the event, not by a full sync.
      expect(catalog.fullSyncs()).toBe(syncsBefore);
    } finally {
      await catalog.backend.stop();
    }
  });
});
