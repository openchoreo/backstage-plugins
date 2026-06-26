import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import {
  searchApiRef,
  SearchContextProvider,
} from '@backstage/plugin-search-react';
import { catalogPlugin } from '@backstage/plugin-catalog';
import { CustomSearchModal } from './CustomSearchModal';

// Backstage 1.51.x's search context skips the very first empty-term query on
// mount (`isFirstEmptyMount`). The modal renders <SearchResult> in controlled
// (query) mode so it queries the backend on open regardless — these tests guard
// that default results show up with an empty term, without the user typing.

const templateDoc = {
  title: 'My Template',
  text: 'A scaffolder template',
  location: '/catalog/default/template/my-template',
  kind: 'Template',
  namespace: 'default',
  type: 'service',
};

const componentDoc = {
  title: 'My Component',
  text: 'A catalog component',
  location: '/catalog/default/component/my-component',
  kind: 'Component',
  namespace: 'default',
};

const mockSearchApi = {
  query: jest.fn(),
};

async function renderModal() {
  await renderInTestApp(
    <TestApiProvider apis={[[searchApiRef, mockSearchApi as any]]}>
      <SearchContextProvider>
        <CustomSearchModal toggleModal={jest.fn()} />
      </SearchContextProvider>
    </TestApiProvider>,
    {
      mountedRoutes: {
        '/catalog/:namespace/:kind/:name': catalogPlugin.routes.catalogEntity,
      },
    },
  );
}

describe('CustomSearchModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchApi.query.mockResolvedValue({
      numberOfResults: 2,
      results: [
        { type: 'software-catalog', rank: 1, document: templateDoc },
        { type: 'software-catalog', rank: 2, document: componentDoc },
      ],
    });
  });

  it('queries the backend with an empty term on open (no typing)', async () => {
    await renderModal();

    expect(mockSearchApi.query).toHaveBeenCalledWith(
      expect.objectContaining({ term: '' }),
    );
  });

  it('shows default results on open without "no results"', async () => {
    await renderModal();

    // Template surfaces under the "Create" section, component under results.
    expect(await screen.findByText('My Template')).toBeInTheDocument();
    expect(await screen.findByText('My Component')).toBeInTheDocument();
    expect(
      screen.queryByText(/no results were found/i),
    ).not.toBeInTheDocument();
  });
});
