import {
  immediateCatalogServiceFactory,
  annotationStoreFactory,
} from '@openchoreo/backstage-plugin-catalog-backend-module';
import {
  portalBackendFeatures,
  portalFeatureLoaders,
  portalServiceFactories,
} from './features';

describe('portalBackendFeatures', () => {
  it('is a backend feature loader', () => {
    expect((portalBackendFeatures as any).$$type).toBe(
      '@backstage/BackendFeature',
    );
    expect((portalBackendFeatures as any).featureType).toBe('loader');
  });

  it('registers the OpenChoreo service factories ahead of the plugins', () => {
    // openchoreo-backend depends on the AnnotationStore initialized by the
    // catalog module, so the factories must be registered before any plugin.
    expect(portalServiceFactories).toEqual([
      immediateCatalogServiceFactory,
      annotationStoreFactory,
    ]);
  });

  it('composes the full portal plugin set', () => {
    // If you add or remove a feature in features.ts, update this count —
    // the composition is this package's contract.
    expect(portalFeatureLoaders).toHaveLength(28);
    for (const load of portalFeatureLoaders) {
      expect(typeof load).toBe('function');
    }
  });
});
