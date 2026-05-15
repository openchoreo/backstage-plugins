import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { ResourceOverviewCard } from './ResourceOverviewCard';

jest.mock('@backstage/core-components', () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

jest.mock('@openchoreo/backstage-design-system', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
}));

jest.mock('../DataplaneOverview/styles', () => ({
  useDataplaneOverviewStyles: () => ({
    card: '',
    cardHeader: '',
    statusGrid: '',
    statusItem: '',
    statusIcon: '',
    statusLabel: '',
    statusValue: '',
    infoRow: '',
    infoLabel: '',
    infoValue: '',
  }),
}));

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Resource',
    metadata: {
      name: 'analytics-db',
      namespace: 'finance',
      annotations: {
        'openchoreo.io/namespace': 'finance',
        'openchoreo.io/project': 'analytics',
        'openchoreo.io/resource': 'analytics-db',
        'openchoreo.io/resource-type': 'postgres',
        'openchoreo.io/resource-type-kind': 'ResourceType',
        'openchoreo.io/created-at': '2026-05-15T10:00:00Z',
      },
    },
    spec: {
      type: 'postgres',
      owner: 'group:default/devs',
      system: 'analytics',
      parameters: { size: 'small', replicas: 2 },
    },
    ...overrides,
  } as Entity;
}

function renderCard(entity: Entity) {
  return render(
    <MemoryRouter>
      <EntityProvider entity={entity}>
        <ResourceOverviewCard />
      </EntityProvider>
    </MemoryRouter>,
  );
}

describe('ResourceOverviewCard', () => {
  it('renders the resource type name and links to the namespaced ResourceType entity', () => {
    renderCard(makeEntity());
    const typeLink = screen.getByText('postgres').closest('a');
    expect(typeLink).toHaveAttribute(
      'href',
      '/catalog/finance/resourcetype/postgres',
    );
    expect(screen.getByText('ResourceType')).toBeInTheDocument();
  });

  it('links to the cluster-scoped catalog path when the type kind is ClusterResourceType', () => {
    const entity = makeEntity({
      metadata: {
        name: 'shared-cache',
        annotations: {
          'openchoreo.io/namespace': 'finance',
          'openchoreo.io/resource-type': 'redis',
          'openchoreo.io/resource-type-kind': 'ClusterResourceType',
        },
      } as any,
    });
    renderCard(entity);
    const typeLink = screen.getByText('redis').closest('a');
    expect(typeLink).toHaveAttribute(
      'href',
      '/catalog/openchoreo-cluster/clusterresourcetype/redis',
    );
    expect(screen.getByText('ClusterResourceType')).toBeInTheDocument();
  });

  it('renders each parameter key/value pair', () => {
    renderCard(makeEntity());
    expect(screen.getByText('size')).toBeInTheDocument();
    expect(screen.getByText('small')).toBeInTheDocument();
    expect(screen.getByText('replicas')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows the empty-state message when no parameters are set', () => {
    const entity = makeEntity({
      spec: { type: 'postgres', owner: 'group:default/devs' } as any,
    });
    renderCard(entity);
    expect(screen.getByText('No parameters set.')).toBeInTheDocument();
  });

  it('omits the created-at row when the annotation is missing', () => {
    const entity = makeEntity({
      metadata: {
        name: 'analytics-db',
        annotations: {
          'openchoreo.io/resource-type': 'postgres',
          'openchoreo.io/resource-type-kind': 'ResourceType',
        },
      } as any,
    });
    renderCard(entity);
    expect(screen.queryByText('Created')).not.toBeInTheDocument();
  });
});
