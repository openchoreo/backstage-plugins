import { CachingCatalogApi } from '@openchoreo/backstage-plugin-react';
import {
  catalogGraphPluginAlpha,
  catalogPluginAlpha,
  createCachingCatalogApi,
  customAppModule,
  scaffolderPluginAlpha,
} from './customOverrides';

const makeDeps = (identity: unknown) =>
  ({
    discoveryApi: { getBaseUrl: async () => 'http://localhost/api' },
    fetchApi: { fetch: async () => new Response('{}') },
    identityApi: identity,
  } as unknown as Parameters<typeof createCachingCatalogApi>[0]);

describe('createCachingCatalogApi', () => {
  it('builds a CachingCatalogApi from the catalog deps', () => {
    const api = createCachingCatalogApi(
      makeDeps({
        getBackstageIdentity: jest
          .fn()
          .mockResolvedValue({ userEntityRef: 'user:default/alice' }),
      }),
    );
    expect(api).toBeInstanceOf(CachingCatalogApi);
  });

  it('resolves the user ref via identityApi when a read runs', async () => {
    const getBackstageIdentity = jest
      .fn()
      .mockResolvedValue({ userEntityRef: 'user:default/alice' });
    const api = createCachingCatalogApi(makeDeps({ getBackstageIdentity }));

    // Exercise reads so getUserRef (which calls getBackstageIdentity) fires.
    await api.getEntities({ filter: { kind: 'component' } });
    await api.getEntities({ filter: { kind: 'api' } });
    expect(getBackstageIdentity).toHaveBeenCalled();
  });

  it('falls back to an unscoped ref when identity rejects, without throwing', async () => {
    const api = createCachingCatalogApi(
      makeDeps({
        getBackstageIdentity: jest.fn().mockRejectedValue(new Error('no auth')),
      }),
    );
    // A read must still succeed (keys fall back to the pending sentinel) rather
    // than surfacing the identity rejection.
    await expect(
      api.getEntities({ filter: { kind: 'component' } }),
    ).resolves.toBeDefined();
  });
});

describe('customOverrides', () => {
  it('exports a catalog-graph plugin override', () => {
    expect(catalogGraphPluginAlpha).toBeDefined();
    expect((catalogGraphPluginAlpha as any).id).toBe('catalog-graph');
  });

  it('exports a catalog plugin override', () => {
    expect(catalogPluginAlpha).toBeDefined();
    expect((catalogPluginAlpha as any).id).toBe('catalog');
  });

  it('exports a scaffolder plugin override', () => {
    expect(scaffolderPluginAlpha).toBeDefined();
    expect((scaffolderPluginAlpha as any).id).toBe('scaffolder');
  });

  it('exports the customAppModule frontend module', () => {
    expect(customAppModule).toBeDefined();
    // `createFrontendModule({ pluginId: 'app', ... })` produces a frontend
    // module bound to the `app` plugin id.
    expect(
      (customAppModule as any).id ?? (customAppModule as any).pluginId,
    ).toBe('app');
  });

  it('registers extensions on the customAppModule (SignInPage, Translation, Progress swap)', () => {
    const extensions = ((customAppModule as any).extensions ?? []) as Array<{
      id: string;
    }>;
    expect(Array.isArray(extensions)).toBe(true);

    // SignInPage, Translation override (catalog-import), and the
    // core-progress swappable-component override (PageLoader). The
    // assistant's LogRowAction renderer moved to the host app (packages/app)
    // when the shell became publishable.
    expect(extensions).toHaveLength(3);
    expect(extensions.map(e => e.id)).toContain('component:app/progress');
  });
});
