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
    expect(portalFeatureLoaders).toHaveLength(29);
    for (const load of portalFeatureLoaders) {
      expect(typeof load).toBe('function');
    }
  });

  it('registers the incremental ingestion module between the catalog module and openchoreo-backend', () => {
    // Ordering contract (see features.ts): the incremental ingestion module
    // must load after '@openchoreo/backstage-plugin-catalog-backend-module'
    // (index 19) and before '@openchoreo/backstage-plugin-backend'
    // (index 21); it sits at index 20, right between the two. Jest's VM
    // sandbox cannot invoke dynamic imports (that needs
    // --experimental-vm-modules), so the thunks are identified by their
    // source text instead. If you add or remove a feature in features.ts,
    // update these indexes.
    const loaderName = (i: number) => portalFeatureLoaders[i].toString();
    expect(loaderName(19)).toContain(
      "'@openchoreo/backstage-plugin-catalog-backend-module'",
    );
    expect(loaderName(20)).toContain(
      "'@openchoreo/backstage-plugin-catalog-backend-module-openchoreo-incremental'",
    );
    expect(loaderName(21)).toContain("'@openchoreo/backstage-plugin-backend'");
  });
});
