import { render, screen } from '@testing-library/react';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { ResourceParametersCard } from './ResourceParametersCard';

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

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Resource',
    metadata: {
      name: 'analytics-db',
      namespace: 'finance',
    },
    spec: {
      type: 'postgres',
      owner: 'group:default/devs',
      parameters: { size: 'small', replicas: 2 },
    },
    ...overrides,
  } as Entity;
}

function renderCard(entity: Entity) {
  return render(
    <EntityProvider entity={entity}>
      <ResourceParametersCard />
    </EntityProvider>,
  );
}

describe('ResourceParametersCard', () => {
  it('renders each parameter key/value pair', () => {
    renderCard(makeEntity());
    expect(screen.getByText('size')).toBeInTheDocument();
    expect(screen.getByText('small')).toBeInTheDocument();
    expect(screen.getByText('replicas')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders the count in the header', () => {
    renderCard(makeEntity());
    expect(screen.getByText('Parameters (2)')).toBeInTheDocument();
  });

  it('shows the empty-state message when no parameters are set', () => {
    renderCard(
      makeEntity({
        spec: { type: 'postgres', owner: 'group:default/devs' } as any,
      }),
    );
    expect(screen.getByText('No parameters set.')).toBeInTheDocument();
    expect(screen.getByText('Parameters (0)')).toBeInTheDocument();
  });

  it('JSON-stringifies array parameter values', () => {
    renderCard(
      makeEntity({
        spec: {
          type: 'postgres',
          parameters: { tags: ['a', 'b'] },
        } as any,
      }),
    );
    expect(screen.getByText('["a","b"]')).toBeInTheDocument();
  });

  it('flattens nested object parameters into dot-path rows', () => {
    renderCard(
      makeEntity({
        spec: {
          type: 'postgres',
          parameters: {
            database: { name: 'orders', size: 'small' },
            backup: { enabled: true },
          },
        } as any,
      }),
    );
    expect(screen.getByText('database.name')).toBeInTheDocument();
    expect(screen.getByText('orders')).toBeInTheDocument();
    expect(screen.getByText('database.size')).toBeInTheDocument();
    expect(screen.getByText('small')).toBeInTheDocument();
    expect(screen.getByText('backup.enabled')).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();
    expect(screen.getByText('Parameters (3)')).toBeInTheDocument();
  });

  it('handles multiple levels of nesting', () => {
    renderCard(
      makeEntity({
        spec: {
          type: 'postgres',
          parameters: { a: { b: { c: 42 } } },
        } as any,
      }),
    );
    expect(screen.getByText('a.b.c')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });
});
