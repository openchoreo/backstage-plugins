import { startTestBackend } from '@backstage/backend-test-utils';
import { createServiceFactory } from '@backstage/backend-plugin-api';
import { choreoPlugin } from './plugin';
import { catalogServiceMock } from '@backstage/plugin-catalog-node/testUtils';
import { annotationStoreRef } from '@openchoreo/backstage-plugin-catalog-backend-module';

// Mock AnnotationStore service factory for tests
const mockAnnotationStore = createServiceFactory({
  service: annotationStoreRef,
  deps: {},
  factory: () => ({
    getAnnotations: jest.fn().mockResolvedValue({}),
    setAnnotations: jest.fn().mockResolvedValue(undefined),
    deleteAllAnnotations: jest.fn().mockResolvedValue(undefined),
  }),
});

describe('plugin', () => {
  it('should start the plugin without config', async () => {
    const { server } = await startTestBackend({
      features: [choreoPlugin, mockAnnotationStore],
    });

    expect(server).toBeDefined();
  });

  it('should start the plugin with catalog service', async () => {
    const { server } = await startTestBackend({
      features: [
        choreoPlugin,
        mockAnnotationStore,
        catalogServiceMock.factory({
          entities: [
            {
              apiVersion: 'backstage.io/v1alpha1',
              kind: 'Component',
              metadata: {
                name: 'my-component',
                namespace: 'default',
                title: 'My Component',
              },
              spec: {
                type: 'service',
                owner: 'me',
              },
            },
          ],
        }),
      ],
    });

    expect(server).toBeDefined();
  });
});
