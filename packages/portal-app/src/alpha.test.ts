import { ConfigReader } from '@backstage/config';
import { resolveAsyncFeatures } from '@backstage/frontend-defaults';
import openchoreoCiPluginAlpha from '@openchoreo/backstage-plugin-openchoreo-ci/alpha';
import openchoreoObservabilityPluginAlpha from '@openchoreo/backstage-plugin-openchoreo-observability/alpha';
import openchoreoPluginAlpha, {
  openChoreoAppModule,
} from '@openchoreo/backstage-plugin/alpha';
import platformEngineerCorePluginAlpha from '@openchoreo/backstage-plugin-platform-engineer-core/alpha';

import portalFeatureLoader, { portalFeatures } from './alpha';
import { appModule } from './appModule';
import { customAppModule } from './apis/customOverrides';

/**
 * The shell reaches an app through frontend feature discovery, which reads only
 * this file's *default* export. These tests pin the two properties that make
 * that safe: the default export is the shape discovery accepts, and the feature
 * order survives being resolved through the loader (and the nested loader
 * inside `@openchoreo/backstage-plugin/alpha`).
 *
 * Order is asserted by reference rather than by plugin id because several
 * entries are modules or loaders, which carry no id.
 */
describe('portal feature loader', () => {
  it('is default-exported in the shape discovery accepts', () => {
    expect((portalFeatureLoader as any).$$type).toBe(
      '@backstage/FrontendFeatureLoader',
    );
  });

  it('declares every feature the portal is composed of', () => {
    // A guard on the loader staying a *list*, so an accidental
    // `loader: () => []` or a dropped block is visible here.
    expect(portalFeatures.length).toBeGreaterThan(20);
    expect(new Set(portalFeatures).size).toBe(portalFeatures.length);
  });

  describe.each([
    [
      'API-carrying modules before the plugin-scoped overrides that must win',
      appModule,
      customAppModule,
    ],
    [
      'Build (CI) before Deploy (base) in the `deployment` tab group',
      openchoreoCiPluginAlpha,
      openchoreoPluginAlpha,
    ],
    [
      'Platform Overview before Platform Logs',
      platformEngineerCorePluginAlpha,
      openchoreoObservabilityPluginAlpha,
    ],
  ])('keeps %s', (_label, first, second) => {
    it('in the declared order', () => {
      const a = portalFeatures.indexOf(first as any);
      const b = portalFeatures.indexOf(second as any);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(b);
    });
  });

  it('preserves the declared order through loader resolution', async () => {
    const { features } = await resolveAsyncFeatures({
      config: new ConfigReader({}),
      features: [portalFeatureLoader],
    });

    // `resolveAsyncFeatures` splices a loader's features in at the loader's
    // own position, so the resolved list is `portalFeatures` with the nested
    // `@openchoreo/backstage-plugin/alpha` loader expanded in place. Every
    // feature we declared must still arrive in the order we declared it.
    const resolved = new Set<unknown>(features);
    const declared = portalFeatures.filter(f => resolved.has(f));
    const positions = declared.map(f => features.indexOf(f as any));

    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    // The nested loader contributed features of its own, so resolution
    // expanded rather than merely copied the list.
    expect(features.length).toBeGreaterThan(declared.length);
  });

  it('leaves de-duplication to the app, keeping the first occurrence', async () => {
    const { features } = await resolveAsyncFeatures({
      config: new ConfigReader({}),
      features: [portalFeatureLoader],
    });

    // Resolution expands loaders but does *not* de-duplicate features, so
    // `openChoreoAppModule` arrives twice: once from its explicit slot near the
    // top of `portalFeatures`, and again from the nested
    // `@openchoreo/backstage-plugin/alpha` loader much further down.
    expect(
      features.filter(f => f === openChoreoAppModule).length,
    ).toBeGreaterThan(1);

    // That is safe only because `prepareSpecializedApp` de-duplicates on first
    // insertion, so the early slot is the one that takes effect — which is what
    // keeps the module's API overrides ahead of the `withOverrides` below it.
    // Removing the explicit slot as "redundant" would silently move it.
    expect(features.indexOf(openChoreoAppModule)).toBeLessThan(
      features.indexOf(customAppModule),
    );
  });
});
