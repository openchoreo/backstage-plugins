import { discoverAvailableFeatures } from '@backstage/frontend-defaults';
import portalFeatureLoader from '@openchoreo/backstage-portal-app/alpha';
import pkg from '../package.json';

const SHELL = '@openchoreo/backstage-portal-app';

/**
 * This app is composed by frontend feature discovery: `App.tsx` has no
 * `features` array, so there is no import for a compiler to check. Drop the
 * portal dependency or `app.packages`, and the portal renders empty with no
 * error anywhere. These assertions cover the links a unit test can reach.
 */
describe('frontend feature discovery', () => {
  it('keeps the portal shell a direct dependency of this package', () => {
    // Discovery scans only the app package's own `dependencies`: not
    // devDependencies, and not transitively.
    expect(Object.keys(pkg.dependencies)).toContain(SHELL);
  });

  it('resolves the shell default export as a feature loader', () => {
    expect((portalFeatureLoader as any)?.$$type).toBe(
      '@backstage/FrontendFeatureLoader',
    );
  });

  describe('with the build-time global in place', () => {
    // `app.packages` makes the CLI generate a module that sets this global
    // from the detected packages. Jest has no bundler, so stand it up by hand
    // in the shape `detectPackages` produces.
    const discovered = {
      modules: [
        { name: SHELL, export: undefined, default: undefined },
        { name: SHELL, export: './alpha', default: portalFeatureLoader },
      ],
    };

    beforeEach(() => {
      (window as any)['__@backstage/discovered__'] = discovered;
    });

    afterEach(() => {
      delete (window as any)['__@backstage/discovered__'];
    });

    it('installs the portal shell with `app.packages: all`', () => {
      const { features } = discoverAvailableFeatures({
        getOptional: (key: string) =>
          key === 'app.packages' ? 'all' : undefined,
      } as any);
      expect(features).toEqual([portalFeatureLoader]);
    });

    it('installs nothing at all without `app.packages`', () => {
      const { features } = discoverAvailableFeatures({
        getOptional: () => undefined,
      } as any);
      expect(features).toEqual([]);
    });
  });
});
