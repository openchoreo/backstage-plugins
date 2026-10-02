import { openChoreoAppModule } from './appModule';

function extensionIds(): string[] {
  return ((openChoreoAppModule as any).extensions as Array<{ id: string }>).map(
    e => e.id,
  );
}

describe('openChoreoAppModule', () => {
  it('overrides the core fetch and permission APIs', () => {
    expect(extensionIds()).toEqual(
      expect.arrayContaining([
        'api:app/core.fetch',
        'api:app/plugin.permission.api',
      ]),
    );
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
