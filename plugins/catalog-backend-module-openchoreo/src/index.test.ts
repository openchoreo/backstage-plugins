import defaultExport, {
  annotationStoreFactory,
  catalogModuleOpenchoreo,
  immediateCatalogServiceFactory,
} from './index';

describe('catalog-backend-module-openchoreo package exports', () => {
  it('exposes a backend feature as the default export', () => {
    expect((defaultExport as any).$$type).toBe('@backstage/BackendFeature');
  });

  it('loads the catalog module together with the services it depends on', async () => {
    const loaded = [...(await (defaultExport as any).loader({}))];

    expect(loaded).toEqual([
      catalogModuleOpenchoreo,
      immediateCatalogServiceFactory,
      annotationStoreFactory,
    ]);
  });
});
