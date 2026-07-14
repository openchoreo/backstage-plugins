import {
  catalogGraphPluginAlpha,
  catalogPluginAlpha,
  customAppModule,
  scaffolderPluginAlpha,
} from './customOverrides';

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

  it('registers extensions on the customAppModule (SignInPage, Translation, LogRowAction, Progress swap)', () => {
    const extensions = ((customAppModule as any).extensions ?? []) as Array<{
      id: string;
    }>;
    expect(Array.isArray(extensions)).toBe(true);

    // SignInPage, Translation override (catalog-import), LogRowAction renderer,
    // and the core-progress swappable-component override (PageLoader).
    expect(extensions).toHaveLength(4);
    expect(extensions.map(e => e.id)).toContain('component:app/progress');
  });
});
