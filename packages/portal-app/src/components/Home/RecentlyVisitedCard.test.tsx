import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import { visitsApiRef } from '@backstage/plugin-home';

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  getNodeColor: () => '#336699',
  getDefaultNodeColor: () => '#999999',
  KIND_FULL_LABELS: {},
}));
jest.mock('@openchoreo/backstage-design-system', () => ({
  useChoreoTokens: () => ({ entityKindDefault: { accent: '#123456' } }),
}));
jest.mock('@backstage/plugin-catalog-react', () => ({
  ...jest.requireActual('@backstage/plugin-catalog-react'),
  EntityRefLink: ({ entityRef }: { entityRef: string }) => (
    <span data-testid="entity-ref">{entityRef}</span>
  ),
}));

import { RecentlyVisitedContent } from './RecentlyVisitedCard';

const list = jest.fn();

const pageVisit = (pathname: string, name: string, minutesAgo = 1) => ({
  id: `${pathname}-${name}`,
  pathname,
  name,
  hits: 1,
  timestamp: Date.now() - minutesAgo * 60_000,
});

function renderContent() {
  return renderInTestApp(
    <TestApiProvider apis={[[visitsApiRef, { list }]]}>
      <RecentlyVisitedContent />
    </TestApiProvider>,
  );
}

describe('RecentlyVisitedContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the empty state when there are no visits', async () => {
    list.mockResolvedValue([]);
    await renderContent();

    expect(
      await screen.findByText('No recently visited pages.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'View more' }),
    ).not.toBeInTheDocument();
  });

  it('renders entity and page visits', async () => {
    list.mockResolvedValue([
      {
        id: 'e1',
        entityRef: 'component:default/foo',
        pathname: '/catalog/default/component/foo',
        name: 'foo',
        hits: 1,
        timestamp: Date.now(),
      },
      pageVisit('/catalog', 'Catalog'),
    ]);
    await renderContent();

    expect(await screen.findByTestId('entity-ref')).toHaveTextContent(
      'component:default/foo',
    );
    expect(screen.getByText('Catalog')).toBeInTheDocument();
  });

  it('toggles between View more and View less when over the open limit', async () => {
    list.mockResolvedValue([
      pageVisit('/a', 'A', 1),
      pageVisit('/b', 'B', 2),
      pageVisit('/c', 'C', 3),
      pageVisit('/d', 'D', 4),
      pageVisit('/e', 'E', 5),
    ]);
    await renderContent();

    const toggle = await screen.findByRole('button', { name: 'View more' });
    await userEvent.click(toggle);
    expect(
      screen.getByRole('button', { name: 'View less' }),
    ).toBeInTheDocument();
  });

  it('renders loading skeletons before the visits resolve', async () => {
    list.mockReturnValue(new Promise(() => {}));
    const { container } = await renderContent();

    expect(
      screen.queryByText('No recently visited pages.'),
    ).not.toBeInTheDocument();
    expect(
      container.querySelectorAll('.MuiSkeleton-root').length,
    ).toBeGreaterThan(0);
  });
});
