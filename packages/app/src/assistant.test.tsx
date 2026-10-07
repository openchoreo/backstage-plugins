import {
  AssistantDrawerProvider,
  FailedBuildSnackbar,
  PerchAgentClient,
} from '@openchoreo/backstage-plugin-openchoreo-portal-assistant';
import { assistantFeature, assistantIntegration } from './assistant';

describe('assistant wiring', () => {
  it('fills every shell integration slot', () => {
    expect(assistantIntegration.AppWrapper).toBe(AssistantDrawerProvider);
    expect(assistantIntegration.BuildFailureNotifier).toBe(FailedBuildSnackbar);
    expect(assistantIntegration.renderInvestigateAction).toEqual(
      expect.any(Function),
    );
  });

  it('constructs the perch client the api factory registers', () => {
    // Replaces the factory coverage that lived in portal-app's apis.test.ts
    // before the assistant moved out of the published shell.
    const client = new PerchAgentClient({
      discoveryApi: { getBaseUrl: async () => 'http://localhost' } as any,
      fetchApi: { fetch: (() => undefined) as any } as any,
    });
    expect(client).toBeInstanceOf(PerchAgentClient);
  });

  it('exposes the assistant as an installable frontend feature', () => {
    expect(assistantFeature).toBeDefined();
  });
});
