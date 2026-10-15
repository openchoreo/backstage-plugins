import assistantFeature from '@openchoreo/backstage-plugin-openchoreo-portal-assistant/alpha';
import pkg from '../package.json';

const ASSISTANT = '@openchoreo/backstage-plugin-openchoreo-portal-assistant';

/**
 * The Portal Assistant reaches the portal through frontend feature discovery
 * rather than a `features` array in App.tsx, which is what lets
 * `@openchoreo/backstage-portal-app` carry no dependency on the private
 * plugin. Both links in that chain fail *silently* — drop the dependency or
 * stop default-exporting the module and the assistant simply disappears with
 * no error. There is no e2e coverage of it.
 */
describe('assistant feature discovery', () => {
  it('keeps the assistant a direct dependency of this package', () => {
    // Discovery scans only the app package's own `dependencies` — not
    // devDependencies, and not transitively through portal-app.
    expect(Object.keys(pkg.dependencies)).toContain(ASSISTANT);
  });

  it('resolves the assistant default export as a frontend feature', () => {
    // `discoverAvailableFeatures` keeps a discovered module only if its default
    // export carries one of these two `$$type` markers.
    expect((assistantFeature as any)?.$$type).toBe('@backstage/FrontendModule');
  });
});
