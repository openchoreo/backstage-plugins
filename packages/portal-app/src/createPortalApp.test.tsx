import { PropsWithChildren } from 'react';
import { render, waitFor } from '@testing-library/react';
import {
  ApiBlueprint,
  createFrontendModule,
} from '@backstage/frontend-plugin-api';
import { createPortalApp } from './createPortalApp';
import { portalAssistantIntegrationApiRef } from './assistant/PortalAssistantIntegrationApi';

describe('createPortalApp', () => {
  beforeEach(() => {
    process.env = {
      NODE_ENV: 'test',
      APP_CONFIG: [
        {
          data: {
            app: { title: 'Test' },
            backend: { baseUrl: 'http://localhost:7007' },
            techdocs: {
              storageUrl: 'http://localhost:7007/api/techdocs/static/docs',
            },
          },
          context: 'test',
        },
      ] as any,
    };
  });

  it('renders the portal app', async () => {
    const rendered = render(createPortalApp().createRoot());

    await waitFor(() => {
      expect(rendered.baseElement).toBeInTheDocument();
    });
  });

  it('accepts additional features', async () => {
    const extraModule = createFrontendModule({
      pluginId: 'app',
      extensions: [],
    });

    const rendered = render(
      createPortalApp({ features: [extraModule] }).createRoot(),
    );

    await waitFor(() => {
      expect(rendered.baseElement).toBeInTheDocument();
    });
  });

  it('accepts an assistant integration registered through features', async () => {
    // The seam contract a host app (packages/app, or a custom portal) relies
    // on: an ApiBlueprint for portalAssistantIntegrationApiRef passed via
    // `features` boots without conflicting with the shell's own factories.
    const fakeAssistant = createFrontendModule({
      pluginId: 'app',
      extensions: [
        ApiBlueprint.make({
          name: 'assistant-integration',
          params: defineParams =>
            defineParams({
              api: portalAssistantIntegrationApiRef,
              deps: {},
              factory: () => ({
                AppWrapper: ({ children }: PropsWithChildren<{}>) => (
                  <div data-testid="assistant-app-wrapper">{children}</div>
                ),
              }),
            }),
        }),
      ],
    });

    const rendered = render(
      createPortalApp({ features: [fakeAssistant] }).createRoot(),
    );

    await waitFor(() => {
      expect(rendered.baseElement).toBeInTheDocument();
    });
  });
});
