import { screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  renderInTestApp,
  TestApiProvider,
  mockApis,
} from '@backstage/test-utils';
import { configApiRef, discoveryApiRef } from '@backstage/core-plugin-api';
import { permissionApiRef } from '@backstage/plugin-permission-react';
import {
  catalogApiRef,
  starredEntitiesApiRef,
  MockStarredEntitiesApi,
} from '@backstage/plugin-catalog-react';
import { catalogApiMock } from '@backstage/plugin-catalog-react/testUtils';
import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { openChoreoFetchApiRef } from '@openchoreo/backstage-plugin-react';
import { CustomTemplateListPage } from './CustomTemplateListPage';

jest.mock('@backstage/plugin-scaffolder-react/alpha', () => ({
  ...jest.requireActual('@backstage/plugin-scaffolder-react/alpha'),
  TemplateGroups: () => <div data-testid="template-groups" />,
}));

const mockFetchApi = {
  fetch: jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
} as any;

// The permission hooks behind this page resolve the backend through the
// discovery API, which reads `backend.baseUrl`.
const BASE = { backend: { baseUrl: 'http://localhost:7007' } };
const SUPPORT = {
  ...BASE,
  app: {
    support: {
      url: 'https://example.com/support',
      items: [{ title: 'Chat', links: [{ url: 'https://example.com/chat' }] }],
    },
  },
};

async function renderPage(data: object) {
  await renderInTestApp(
    <TestApiProvider
      apis={[
        [configApiRef, mockApis.config({ data })],
        [catalogApiRef, catalogApiMock()],
        [starredEntitiesApiRef, new MockStarredEntitiesApi()],
        [discoveryApiRef, mockApis.discovery()],
        [openChoreoFetchApiRef, mockFetchApi],
        [permissionApiRef, mockApis.permission()],
      ]}
    >
      <QueryClientProvider client={new QueryClient()}>
        <CustomTemplateListPage />
      </QueryClientProvider>
    </TestApiProvider>,
    {
      // Mounting the scaffolder root is enough: the page's other scaffolder
      // route refs are sub-routes of it.
      mountedRoutes: {
        '/create': scaffolderPlugin.routes.root,
      },
    },
  );
}

describe('CustomTemplateListPage', () => {
  it('shows the support button in the header when app.support is set', async () => {
    await renderPage(SUPPORT);

    expect(
      await screen.findByRole('button', { name: 'Support' }),
    ).toBeInTheDocument();
  });

  it('omits the support button when app.support is unset', async () => {
    await renderPage(BASE);

    expect(
      await screen.findByText('Create a new component'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Support' })).toBeNull();
  });
});
