import { PerchAgentClient, perchAgentApiRef } from './api/PerchAgentApi';
import assistantDefault, { assistantFeature } from './alpha';

describe('assistant alpha module', () => {
  it('exposes the assistant as an installable frontend feature', () => {
    expect(assistantFeature).toBeDefined();
  });

  // Feature discovery reads a package's *default* export and silently ignores
  // anything that isn't a FrontendPlugin/FrontendModule. If this default ever
  // stops being the module, `app.packages` loads nothing and the assistant
  // disappears with no error.
  it('default-exports the feature so `app.packages` discovers it', () => {
    expect(assistantDefault).toBe(assistantFeature);
    expect((assistantDefault as any).$$type).toBe('@backstage/FrontendModule');
  });

  // Replaces the factory coverage that lived in portal-app's apis.test.ts
  // before the assistant moved out of the published shell.
  it('constructs the perch client the api factory registers', () => {
    const client = new PerchAgentClient({
      discoveryApi: { getBaseUrl: async () => 'http://localhost' } as any,
      fetchApi: { fetch: (() => undefined) as any } as any,
    });
    expect(client).toBeInstanceOf(PerchAgentClient);
    expect(perchAgentApiRef.id).toBeTruthy();
  });
});
