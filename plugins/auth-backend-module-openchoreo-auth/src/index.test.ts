import defaultExport, { OpenChoreoAuthModule } from './index';

describe('auth-backend-module-openchoreo-auth package exports', () => {
  it('exposes the module as the default export so discovery can find it', () => {
    expect(defaultExport).toBe(OpenChoreoAuthModule);
  });

  it('exports a backend feature', () => {
    expect((defaultExport as any).$$type).toBe('@backstage/BackendFeature');
  });
});
