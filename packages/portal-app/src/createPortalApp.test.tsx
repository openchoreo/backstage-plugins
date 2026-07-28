import { render, waitFor } from '@testing-library/react';
import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { createPortalApp } from './createPortalApp';

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
});
