import { screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  renderInTestApp,
  TestApiProvider,
  mockApis,
} from '@backstage/test-utils';
import { configApiRef } from '@backstage/core-plugin-api';
import { catalogApiRef, entityRouteRef } from '@backstage/plugin-catalog-react';
import { catalogApiMock } from '@backstage/plugin-catalog-react/testUtils';
import { CustomCatalogPage } from './CustomCatalogPage';

jest.mock('./CatalogCardList', () => ({
  CatalogCardList: () => <div data-testid="card-list" />,
}));
jest.mock('./ChoreoEntityKindPicker', () => ({
  ChoreoEntityKindPicker: () => <div data-testid="kind-picker" />,
}));
jest.mock('./ContextAwareCreateButton', () => ({
  ContextAwareCreateButton: () => <div data-testid="create-button" />,
}));

const SUPPORT = {
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
      ]}
    >
      <QueryClientProvider client={new QueryClient()}>
        <CustomCatalogPage />
      </QueryClientProvider>
    </TestApiProvider>,
    {
      mountedRoutes: {
        '/catalog/:namespace/:kind/:name': entityRouteRef,
      },
    },
  );
}

describe('CustomCatalogPage', () => {
  it('shows the support button in the header when app.support is set', async () => {
    await renderPage(SUPPORT);

    expect(
      await screen.findByRole('button', { name: 'Support' }),
    ).toBeInTheDocument();
  });

  it('omits the support button when app.support is unset', async () => {
    await renderPage({});

    expect(await screen.findByText('Catalog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Support' })).toBeNull();
  });
});
