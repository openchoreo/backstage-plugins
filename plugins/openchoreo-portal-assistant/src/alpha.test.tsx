import {
  PortalAssistantClient,
  portalAssistantApiRef,
} from './api/PortalAssistantApi';
import assistantDefault, { assistantFeature } from './alpha';

describe('assistant alpha module', () => {
  it('exposes the assistant as an installable frontend feature', () => {
    expect(assistantFeature).toBeDefined();
  });

  // Frontend feature discovery reads a package's *default* export and silently
  // ignores anything that isn't a FrontendPlugin/FrontendModule. Discovery is
  // not enabled yet, but keeping this default correct is what makes enabling
  // `app.packages` a config-only change later.
  it('default-exports the feature, as discovery will require', () => {
    expect(assistantDefault).toBe(assistantFeature);
    expect((assistantDefault as any).$$type).toBe('@backstage/FrontendModule');
  });

  // Replaces the factory coverage that lived in portal-app's apis.test.ts
  // before the assistant moved out of the published shell.
  it('constructs the assistant client the api factory registers', () => {
    const client = new PortalAssistantClient({
      discoveryApi: { getBaseUrl: async () => 'http://localhost' } as any,
      fetchApi: { fetch: (() => undefined) as any } as any,
    });
    expect(client).toBeInstanceOf(PortalAssistantClient);
    expect(portalAssistantApiRef.id).toBeTruthy();
  });
});
