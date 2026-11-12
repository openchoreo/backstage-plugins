import { render, screen } from '@testing-library/react';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { EndpointRoutingCard, trafficShares } from './EndpointRoutingCard';
import { EndpointApiCard } from './EndpointApiCard';

jest.mock('@backstage/plugin-catalog-react', () => ({
  ...jest.requireActual('@backstage/plugin-catalog-react'),
  EntityRefLink: ({ entityRef }: any) => (
    <span>{`${entityRef.kind}:${entityRef.namespace}/${entityRef.name}`}</span>
  ),
}));

jest.mock('@openchoreo/backstage-design-system', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
}));

jest.mock('../DataplaneOverview/styles', () => ({
  useDataplaneOverviewStyles: () => ({
    card: '',
    cardHeader: '',
    statusValue: '',
    infoRow: '',
    infoLabel: '',
    infoValue: '',
  }),
}));

function makeEntity(
  spec: Record<string, unknown> = {},
  typeKind = 'EndpointType',
): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Endpoint',
    metadata: {
      name: 'orders-api',
      namespace: 'acme',
      annotations: {
        'openchoreo.io/endpointtype': 'http-route',
        'openchoreo.io/endpointtype-kind': typeKind,
      },
    },
    spec: {
      type: 'http-route',
      visibility: ['internal', 'external'],
      backends: [
        { name: 'primary', component: 'orders', endpoint: 'http', weight: 90 },
        {
          name: 'canary',
          component: 'orders-v2',
          endpoint: 'http',
          weight: 10,
        },
      ],
      ...spec,
    },
  } as Entity;
}

function renderWith(entity: Entity, card: JSX.Element) {
  return render(<EntityProvider entity={entity}>{card}</EntityProvider>);
}

describe('trafficShares', () => {
  it('splits by relative weight', () => {
    expect(
      trafficShares([
        { name: 'a', weight: 3 },
        { name: 'b', weight: 1 },
      ]),
    ).toEqual([75, 25]);
  });

  it('counts a missing weight as the default of 1', () => {
    expect(trafficShares([{ name: 'a' }, { name: 'b' }])).toEqual([50, 50]);
  });

  it('sends nothing anywhere when every weight is 0', () => {
    expect(trafficShares([{ name: 'a', weight: 0 }])).toEqual([0]);
  });
});

describe('EndpointRoutingCard', () => {
  it('links the namespaced type and each backend component', () => {
    renderWith(makeEntity(), <EndpointRoutingCard />);

    expect(
      screen.getByText('endpointtype:acme/http-route'),
    ).toBeInTheDocument();
    expect(screen.getByText('component:acme/orders')).toBeInTheDocument();
    expect(screen.getByText('component:acme/orders-v2')).toBeInTheDocument();
  });

  it('links a cluster type in the openchoreo-cluster namespace', () => {
    renderWith(makeEntity({}, 'ClusterEndpointType'), <EndpointRoutingCard />);

    expect(
      screen.getByText('clusterendpointtype:openchoreo-cluster/http-route'),
    ).toBeInTheDocument();
  });

  it('shows visibility and each backend share of traffic', () => {
    renderWith(makeEntity(), <EndpointRoutingCard />);

    expect(screen.getByText('internal')).toBeInTheDocument();
    expect(screen.getByText('external')).toBeInTheDocument();
    expect(screen.getByText('Backends (2)')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();
  });

  it('shows an empty state without backends', () => {
    renderWith(makeEntity({ backends: [] }), <EndpointRoutingCard />);

    expect(screen.getByText('No backends configured.')).toBeInTheDocument();
  });
});

describe('EndpointApiCard', () => {
  it('links the API entity carrying the schema', () => {
    renderWith(
      makeEntity({ providesApi: 'api:acme/endpoint-orders-api' }),
      <EndpointApiCard />,
    );

    expect(
      screen.getByText('api:acme/endpoint-orders-api'),
    ).toBeInTheDocument();
  });

  it('explains why there is no API without a schema', () => {
    renderWith(makeEntity(), <EndpointApiCard />);

    expect(
      screen.getByText(
        'This endpoint declares no schema, so it has no API definition.',
      ),
    ).toBeInTheDocument();
  });
});

describe('EndpointRoutingCard is read-only', () => {
  it('offers no actions; backends are managed from the Deploy tab', () => {
    renderWith(makeEntity(), <EndpointRoutingCard />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
