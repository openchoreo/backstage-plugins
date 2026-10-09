import { openChoreoAppModule } from './appModule';

function extensionIds(): string[] {
  return ((openChoreoAppModule as any).extensions as Array<{ id: string }>).map(
    e => e.id,
  );
}

describe('openChoreoAppModule', () => {
  it('overrides the permission API', () => {
    expect(extensionIds()).toEqual(
      expect.arrayContaining(['api:app/plugin.permission.api']),
    );
  });

  // Replacing the app-wide fetch API would strip the host's own middleware for
  // every plugin and attach OpenChoreo credentials to unrelated requests;
  // OpenChoreo calls go through `openChoreoFetchApiRef` instead.
  it('does not override the app-wide fetch API', () => {
    expect(extensionIds()).not.toContain('api:app/core.fetch');
  });

  // Themes ship from here (not the portal) so a host app that only installs
  // the plugins still renders OpenChoreo surfaces with the right palette.
  it('contributes the OpenChoreo light and dark themes', () => {
    expect(extensionIds()).toEqual(
      expect.arrayContaining([
        'theme:app/openchoreo-light',
        'theme:app/openchoreo-dark',
      ]),
    );
  });
});
