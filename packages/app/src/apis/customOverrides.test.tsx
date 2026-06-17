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

  it('registers extensions on the customAppModule (SignInPage, Translation, LogRowAction)', () => {
    const extensions = ((customAppModule as any).extensions ?? []) as Array<{
      id: string;
    }>;
    expect(Array.isArray(extensions)).toBe(true);
    expect(extensions.length).toBeGreaterThan(0);

    // The host registers exactly three extensions on the app module today:
    // a SignInPage, a Translation override (catalog-import), and a
    // LogRowAction renderer. Overview-slot cards (OpenChoreoAboutCard,
    // WorkflowsOrExternalCICard) used to live here but moved back into the
    // hand-authored `entityPage` JSX when we restored the custom
    // page:catalog/entity override — see customOverrides.tsx for context.
    expect(extensions).toHaveLength(3);
  });
});
