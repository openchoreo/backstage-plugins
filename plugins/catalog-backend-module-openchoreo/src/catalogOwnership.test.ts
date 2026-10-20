import {
  coreServices,
  createBackendPlugin,
  createServiceFactory,
} from '@backstage/backend-plugin-api';
import { mockServices, startTestBackend } from '@backstage/backend-test-utils';
import { Entity } from '@backstage/catalog-model';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import catalogPlugin from '@backstage/plugin-catalog-backend';
import {
  catalogModuleOpenchoreo,
  immediateCatalogServiceFactory,
} from './module';
import { OpenChoreoEntityProvider } from './provider/OpenChoreoEntityProvider';
import {
  ImmediateCatalogService,
  immediateCatalogServiceRef,
} from './service/ImmediateCatalogService';
import { annotationStoreRef } from './service/AnnotationStore';

// End-to-end check against the real catalog backend and database: an entity
// written through ImmediateCatalogService must be removed by the provider's
// full sync once it no longer exists in OpenChoreo (openchoreo/openchoreo#4993).

const mockGET = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({ GET: mockGET })),
  fetchAllPages: jest.fn((fetchPage: (cursor?: string) => Promise<any>) =>
    fetchPage(undefined).then((page: any) => page.items ?? []),
  ),
}));

const entityRef = 'component:test-ns/portal-service';

const portalComponent: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'portal-service',
    namespace: 'test-ns',
    annotations: {
      'backstage.io/managed-by-location': 'provider:OpenChoreoEntityProvider',
      'backstage.io/managed-by-origin-location':
        'provider:OpenChoreoEntityProvider',
    },
  },
  spec: {
    type: 'service',
    lifecycle: 'production',
    owner: 'group:default/test-owner',
  },
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

describe('catalog ownership of immediately inserted entities', () => {
  jest.setTimeout(60_000);

  it('removes a portal-created entity on the next full sync once it is gone from OpenChoreo', async () => {
    // OpenChoreo has no resources at all: the entity was deleted before the
    // next sync could pick it up.
    mockGET.mockResolvedValue({
      data: { items: [] },
      error: undefined,
      response: { ok: true, status: 200 },
    });

    // Calls through; used to get hold of the provider the module registered.
    const connectSpy = jest.spyOn(
      OpenChoreoEntityProvider.prototype,
      'connect',
    );

    let immediateCatalog: ImmediateCatalogService | undefined;
    let readEntity: (() => Promise<Entity | undefined>) | undefined;

    const backend = await startTestBackend({
      features: [
        catalogPlugin,
        catalogModuleOpenchoreo,
        immediateCatalogServiceFactory,
        createServiceFactory({
          service: annotationStoreRef,
          deps: {},
          factory: () =>
            ({
              getAnnotations: async () => ({}),
            } as any),
        }),
        // Stands in for the scaffolder: a separate plugin consuming the service.
        createBackendPlugin({
          pluginId: 'scaffolder',
          register(env) {
            env.registerInit({
              deps: {
                immediate: immediateCatalogServiceRef,
                catalog: catalogServiceRef,
                auth: coreServices.auth,
              },
              async init({ immediate, catalog, auth }) {
                immediateCatalog = immediate;
                readEntity = async () =>
                  catalog.getEntityByRef(entityRef, {
                    credentials: await auth.getOwnServiceCredentials(),
                  });
              },
            });
          },
        }),
        mockServices.rootConfig.factory({
          data: {
            openchoreo: {
              baseUrl: 'http://openchoreo.test',
              events: { enabled: false },
              features: { auth: { enabled: false } },
            },
          },
        }),
      ],
    });

    try {
      await immediateCatalog!.insertEntity(portalComponent);
      const inserted = await waitFor(readEntity!, e => e !== undefined);
      expect(inserted?.metadata.name).toBe('portal-service');

      const provider = connectSpy.mock.contexts[0] as OpenChoreoEntityProvider;
      await provider.run();

      const afterSync = await waitFor(readEntity!, e => e === undefined);
      expect(afterSync).toBeUndefined();
    } finally {
      await backend.stop();
    }
  });
});
