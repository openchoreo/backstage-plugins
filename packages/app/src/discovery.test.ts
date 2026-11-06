import {
  discoverAvailableFeatures,
  resolveAsyncFeatures,
} from '@backstage/frontend-defaults';
import assistantFeature from '@openchoreo/backstage-plugin-openchoreo-portal-assistant/alpha';
import portalFeatureLoader from '@openchoreo/backstage-portal-app/alpha';
import scorecardsFeatureLoader from '@openchoreo/backstage-plugin-tech-insights-scorecards/alpha';
import maturityPlugin from '@backstage-community/plugin-tech-insights-maturity/alpha';
import pkg from '../package.json';

const ASSISTANT = '@openchoreo/backstage-plugin-openchoreo-portal-assistant';
const SHELL = '@openchoreo/backstage-portal-app';
const SCORECARDS = '@openchoreo/backstage-plugin-tech-insights-scorecards';
const MATURITY = '@backstage-community/plugin-tech-insights-maturity';

/**
 * This app is composed entirely by frontend feature discovery — `App.tsx` has
 * no `features` array, so there is no import for a compiler to check and every
 * link fails *silently*. Drop a dependency, drop `app.packages`, or stop
 * default-exporting, and the portal (or the assistant) simply disappears with
 * no error anywhere. There is no e2e coverage of either.
 *
 * These assertions cover the links a unit test can reach. The remaining one —
 * `app.packages` being set at all — is not asserted here because this is a
 * frontend package and its eslint config forbids node builtins, so the test
 * cannot read the YAML.
 */
describe('frontend feature discovery', () => {
  it.each([
    ['the portal shell', SHELL],
    ['the assistant', ASSISTANT],
    ['the scorecards plugin', SCORECARDS],
    ['the maturity API plugin', MATURITY],
  ])('keeps %s a direct dependency of this package', (_label, name) => {
    // Discovery scans only the app package's own `dependencies` — not
    // devDependencies, and not transitively.
    expect(Object.keys(pkg.dependencies)).toContain(name);
  });

  // `discoverAvailableFeatures` keeps a discovered module only if its default
  // export carries one of these `$$type` markers; anything else is dropped
  // without a warning.
  it('resolves the shell default export as a feature loader', () => {
    expect((portalFeatureLoader as any)?.$$type).toBe(
      '@backstage/FrontendFeatureLoader',
    );
  });

  it('resolves the assistant default export as a frontend feature', () => {
    expect((assistantFeature as any)?.$$type).toBe('@backstage/FrontendModule');
  });

  // The scorecards loader carries only the scorecards plugin; the maturity
  // plugin, which provides the API the scorecards read, is discovered on its
  // own.
  it.each([
    [
      'the scorecards plugin',
      scorecardsFeatureLoader,
      '@backstage/FrontendFeatureLoader',
    ],
    ['the maturity API plugin', maturityPlugin, '@backstage/FrontendPlugin'],
  ])(
    'resolves %s default export as a frontend feature',
    (_label, feature, type) => {
      expect((feature as any)?.$$type).toBe(type);
    },
  );

  describe('with the build-time global in place', () => {
    // `app.packages` makes the CLI generate a module that sets this global from
    // the detected packages. Jest has no bundler, so stand it up by hand in the
    // exact shape and order `detectPackages` produces: dependency order (which
    // is alphabetical here, putting the assistant ahead of the shell), and for
    // each package the root entry followed by `./alpha`. Our root entries have
    // no default export, which is why discovery drops them.
    const discovered = {
      modules: [
        { name: ASSISTANT, export: undefined, default: undefined },
        { name: ASSISTANT, export: './alpha', default: assistantFeature },
        { name: SHELL, export: undefined, default: undefined },
        { name: SHELL, export: './alpha', default: portalFeatureLoader },
      ],
    };

    // Only `app.packages` is read off the config here.
    const config = {
      getOptional: (key: string) =>
        key === 'app.packages' ? 'all' : undefined,
    } as any;

    beforeEach(() => {
      (window as any)['__@backstage/discovered__'] = discovered;
    });

    afterEach(() => {
      delete (window as any)['__@backstage/discovered__'];
    });

    it('installs both packages and nothing else', () => {
      const { features } = discoverAvailableFeatures(config);
      expect(features).toEqual([assistantFeature, portalFeatureLoader]);
    });

    it('installs nothing at all without `app.packages`', () => {
      // The whole portal hangs off one config key, so losing it is total.
      const { features } = discoverAvailableFeatures({
        getOptional: () => undefined,
      } as any);
      expect(features).toEqual([]);
    });

    it('expands the shell loader with the assistant ahead of it', async () => {
      const { features: discoveredFeatures } =
        discoverAvailableFeatures(config);
      const { features } = await resolveAsyncFeatures({
        config,
        features: discoveredFeatures,
      });

      // Discovery order puts the assistant first, so its app-root wrapper is
      // registered before the shell's and ends up *inside* them rather than
      // outside — the one behavioural difference from passing the assistant
      // through `createApp({ features })`, where it came last.
      expect(features[0]).toBe(assistantFeature);
      // ... and the shell really did expand, rather than arriving as a loader.
      expect(features.length).toBeGreaterThan(20);
      expect(features).not.toContain(portalFeatureLoader);
    });
  });
});
