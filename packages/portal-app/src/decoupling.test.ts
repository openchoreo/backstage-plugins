import pkg from '../package.json';

/**
 * The shell must not depend on the private Portal Assistant plugin. That
 * dependency is the blocker this package's README names for becoming
 * publishable, so a regression here is expensive and silent: re-introducing an
 * import anywhere under `src/` puts the dependency back and quietly makes the
 * published shell un-shippable again.
 *
 * The assistant ships its own wiring from
 * `@openchoreo/backstage-plugin-openchoreo-portal-assistant/alpha`; the `app`
 * package installs it.
 */
describe('portal-app shell dependencies', () => {
  it('does not depend on the private portal-assistant plugin', () => {
    const all = {
      ...(pkg.dependencies ?? {}),
      ...((pkg as any).devDependencies ?? {}),
      ...((pkg as any).peerDependencies ?? {}),
    };
    expect(Object.keys(all)).not.toContain(
      '@openchoreo/backstage-plugin-openchoreo-portal-assistant',
    );
  });
});
