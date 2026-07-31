import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import { createApiRef } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { Entity } from '@backstage/catalog-model';

const openChoreoClientApiRef = createApiRef<{
  fetchEnvironmentInfo: (entity: Entity) => Promise<unknown>;
}>({ id: 'test.openchoreo.client' });

jest.mock('@openchoreo/backstage-plugin', () => ({
  get openChoreoClientApiRef() {
    return openChoreoClientApiRef;
  },
}));
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  getNodeColor: () => '#336699',
}));
jest.mock('@openchoreo/backstage-design-system', () => ({
  useChoreoTokens: () => ({}),
}));
jest.mock('@backstage/plugin-catalog-react', () => ({
  ...jest.requireActual('@backstage/plugin-catalog-react'),
  EntityRefLink: ({ entityRef }: { entityRef: string }) => (
    <span data-testid="entity-ref">{entityRef}</span>
  ),
}));

import { RecentDeploymentsCard } from './RecentDeploymentsCard';

const component = (name: string, type = 'deployment/service'): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name, namespace: 'default' },
  spec: { type },
});

const minutesAgo = (m: number) =>
  new Date(Date.now() - m * 60_000).toISOString();

const queryEntities = jest.fn();
const fetchEnvironmentInfo = jest.fn();

function renderCard() {
  return renderInTestApp(
    <TestApiProvider
      apis={[
        [catalogApiRef, { queryEntities }],
        [openChoreoClientApiRef, { fetchEnvironmentInfo }],
      ]}
    >
      <RecentDeploymentsCard />
    </TestApiProvider>,
  );
}

describe('RecentDeploymentsCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requests a bounded, newest-first component page', async () => {
    queryEntities.mockResolvedValue({ items: [] });
    await renderCard();

    expect(queryEntities).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { kind: 'Component' },
        limit: 20,
        orderFields: [
          expect.objectContaining({
            field: 'metadata.annotations.openchoreo.io/created-at',
            order: 'desc',
          }),
        ],
      }),
    );
  });

  it('renders one row per deployed component, most recent deploy first', async () => {
    queryEntities.mockResolvedValue({
      items: [component('older'), component('newer', 'proxy/api-proxy')],
    });
    fetchEnvironmentInfo.mockImplementation(async entity => {
      if (entity.metadata.name === 'newer') {
        return [
          {
            name: 'dev',
            deployment: { status: 'Ready', lastDeployed: minutesAgo(5) },
          },
          {
            name: 'prod',
            deployment: { status: 'Failed', lastDeployed: minutesAgo(30) },
          },
        ];
      }
      return [
        {
          name: 'dev',
          deployment: { status: 'Ready', lastDeployed: minutesAgo(90) },
        },
      ];
    });

    await renderCard();

    const refs = (await screen.findAllByTestId('entity-ref')).map(
      el => el.textContent,
    );
    expect(refs).toEqual([
      'component:default/newer',
      'component:default/older',
    ]);
    // Component-type chip shows the type without the workloadType prefix.
    expect(screen.getByText('api-proxy')).toBeInTheDocument();
    // One chip per deployed environment.
    expect(screen.getByText('prod')).toBeInTheDocument();
    expect(screen.getAllByText('dev')).toHaveLength(2);
  });

  it('skips components without deployments and failed environment fetches', async () => {
    queryEntities.mockResolvedValue({
      items: [
        component('deployed'),
        component('undeployed'),
        component('broken'),
      ],
    });
    fetchEnvironmentInfo.mockImplementation(async entity => {
      if (entity.metadata.name === 'deployed') {
        return [
          {
            name: 'dev',
            deployment: { status: 'Ready', lastDeployed: minutesAgo(1) },
          },
        ];
      }
      if (entity.metadata.name === 'undeployed') {
        return [{ name: 'dev', deployment: {} }];
      }
      throw new Error('environment info unavailable');
    });

    await renderCard();

    const refs = (await screen.findAllByTestId('entity-ref')).map(
      el => el.textContent,
    );
    expect(refs).toEqual(['component:default/deployed']);
  });

  it('shows the empty state when nothing has been deployed', async () => {
    queryEntities.mockResolvedValue({ items: [] });
    await renderCard();
    expect(screen.getByText('No recent deployments.')).toBeInTheDocument();
  });

  it('shows the empty state when the catalog query fails', async () => {
    queryEntities.mockRejectedValue(new Error('catalog down'));
    await renderCard();
    expect(
      await screen.findByText('No recent deployments.'),
    ).toBeInTheDocument();
  });

  it('offers View more / View less when more rows exist than shown open', async () => {
    queryEntities.mockResolvedValue({
      items: Array.from({ length: 6 }, (_, i) => component(`comp-${i}`)),
    });
    fetchEnvironmentInfo.mockImplementation(async () => [
      {
        name: 'dev',
        deployment: { status: 'Ready', lastDeployed: minutesAgo(10) },
      },
    ]);

    await renderCard();

    const toggle = await screen.findByRole('button', { name: 'View more' });
    await userEvent.click(toggle);
    expect(
      screen.getByRole('button', { name: 'View less' }),
    ).toBeInTheDocument();
  });
});
