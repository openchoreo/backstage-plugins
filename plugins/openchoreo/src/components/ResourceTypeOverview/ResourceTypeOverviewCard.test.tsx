import { render, screen, waitFor } from '@testing-library/react';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { TestApiProvider } from '@backstage/test-utils';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import { ResourceTypeOverviewCard } from './ResourceTypeOverviewCard';

jest.mock('@openchoreo/backstage-design-system', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  Skeleton: () => <span data-testid="skeleton" />,
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

function makeClusterResourceType(overrides: Partial<Entity> = {}): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'ClusterResourceType',
    metadata: {
      name: 'postgres',
      namespace: 'openchoreo-cluster',
      annotations: {
        'openchoreo.io/created-at': '2026-05-01T00:00:00Z',
      },
    },
    spec: {
      retainPolicy: 'Delete',
    },
    ...overrides,
  } as Entity;
}

function makeResourceType(overrides: Partial<Entity> = {}): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'ResourceType',
    metadata: {
      name: 'redis',
      namespace: 'finance',
      annotations: {
        'openchoreo.io/created-at': '2026-05-01T00:00:00Z',
      },
    },
    spec: {
      retainPolicy: 'Retain',
    },
    ...overrides,
  } as Entity;
}

type ClientOverrides = {
  fetchResourceTypeOutputs?: jest.Mock;
  fetchResourceTypeSchema?: jest.Mock;
};

function renderCard(entity: Entity, clientOverrides: ClientOverrides = {}) {
  const client = {
    fetchResourceTypeOutputs:
      clientOverrides.fetchResourceTypeOutputs ??
      jest.fn().mockResolvedValue({ success: true, data: [] }),
    fetchResourceTypeSchema:
      clientOverrides.fetchResourceTypeSchema ??
      jest.fn().mockResolvedValue({ success: true, data: { properties: {} } }),
  };
  const utils = render(
    <TestApiProvider apis={[[openChoreoClientApiRef, client as any]]}>
      <EntityProvider entity={entity}>
        <ResourceTypeOverviewCard />
      </EntityProvider>
    </TestApiProvider>,
  );
  return { ...utils, client };
}

describe('ResourceTypeOverviewCard', () => {
  describe('title', () => {
    it('renders "ClusterResourceType Details" when entity kind is ClusterResourceType', async () => {
      renderCard(makeClusterResourceType());
      expect(
        await screen.findByText('ClusterResourceType Details'),
      ).toBeInTheDocument();
    });

    it('renders "ResourceType Details" when entity kind is ResourceType', async () => {
      renderCard(makeResourceType());
      expect(
        await screen.findByText('ResourceType Details'),
      ).toBeInTheDocument();
    });
  });

  describe('retainPolicy', () => {
    it('renders the chip when spec.retainPolicy is set', async () => {
      renderCard(makeClusterResourceType());
      expect(await screen.findByText('Retain Policy')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('renders the Retain value', async () => {
      renderCard(makeResourceType());
      expect(await screen.findByText('Retain')).toBeInTheDocument();
    });

    it('hides the chip when spec.retainPolicy is absent', async () => {
      renderCard(
        makeClusterResourceType({
          spec: {} as any,
        }),
      );
      await screen.findByText('ClusterResourceType Details');
      expect(screen.queryByText('Retain Policy')).not.toBeInTheDocument();
    });
  });

  describe('Created date', () => {
    it('renders a formatted Created date when the annotation is present', async () => {
      renderCard(makeClusterResourceType());
      expect(await screen.findByText('Created')).toBeInTheDocument();
      expect(screen.getByText(/2026/)).toBeInTheDocument();
    });

    it('hides the Created row when the annotation is absent', async () => {
      renderCard(
        makeClusterResourceType({
          metadata: {
            name: 'postgres',
            namespace: 'openchoreo-cluster',
          },
        }),
      );
      await screen.findByText('ClusterResourceType Details');
      expect(screen.queryByText('Created')).not.toBeInTheDocument();
    });
  });

  describe('Outputs section', () => {
    it('renders one row per output with name and kind label', async () => {
      renderCard(makeClusterResourceType(), {
        fetchResourceTypeOutputs: jest.fn().mockResolvedValue({
          success: true,
          data: [
            { name: 'host', value: '${secret.host}' },
            { name: 'password', secretKeyRef: { name: 'pg-creds', key: 'pw' } },
            {
              name: 'configmap-url',
              configMapKeyRef: { name: 'pg-cm', key: 'url' },
            },
          ],
        }),
      });

      expect(await screen.findByText('Outputs (3)')).toBeInTheDocument();
      expect(screen.getByText('host')).toBeInTheDocument();
      expect(screen.getByText('password')).toBeInTheDocument();
      expect(screen.getByText('configmap-url')).toBeInTheDocument();
      expect(screen.getByText('Value')).toBeInTheDocument();
      expect(screen.getByText('Secret')).toBeInTheDocument();
      expect(screen.getByText('ConfigMap')).toBeInTheDocument();
    });

    it('renders an empty-state message when the outputs list is empty', async () => {
      renderCard(makeClusterResourceType(), {
        fetchResourceTypeOutputs: jest
          .fn()
          .mockResolvedValue({ success: true, data: [] }),
      });

      expect(await screen.findByText('Outputs (0)')).toBeInTheDocument();
      expect(screen.getByText('No outputs declared.')).toBeInTheDocument();
    });

    it('shows an error message when the fetch rejects', async () => {
      renderCard(makeClusterResourceType(), {
        fetchResourceTypeOutputs: jest
          .fn()
          .mockRejectedValue(new Error('boom')),
      });

      await waitFor(() => {
        expect(
          screen.getByText('Failed to load outputs: boom'),
        ).toBeInTheDocument();
      });
    });

    it('passes RESOURCE_TYPE and RESOURCE_TYPE_KIND annotations on the synthesized ref entity', async () => {
      const fetchResourceTypeOutputs = jest
        .fn()
        .mockResolvedValue({ success: true, data: [] });

      renderCard(makeResourceType(), { fetchResourceTypeOutputs });

      await screen.findByText('Outputs (0)');

      const [refEntity] = fetchResourceTypeOutputs.mock.calls[0];
      expect(
        refEntity.metadata.annotations['openchoreo.io/resource-type'],
      ).toBe('redis');
      expect(
        refEntity.metadata.annotations['openchoreo.io/resource-type-kind'],
      ).toBe('ResourceType');
      expect(refEntity.metadata.annotations['openchoreo.io/namespace']).toBe(
        'finance',
      );
    });
  });

  describe('Parameters Schema section', () => {
    it('renders one row per top-level property with name and type', async () => {
      renderCard(makeClusterResourceType(), {
        fetchResourceTypeSchema: jest.fn().mockResolvedValue({
          success: true,
          data: {
            type: 'object',
            properties: {
              database: { type: 'string' },
              size: { type: 'string', enum: ['small', 'medium', 'large'] },
              replicas: { type: 'integer' },
            },
          },
        }),
      });

      expect(await screen.findByText('Parameters (3)')).toBeInTheDocument();
      expect(screen.getByText('database')).toBeInTheDocument();
      expect(screen.getByText('size')).toBeInTheDocument();
      expect(screen.getByText('replicas')).toBeInTheDocument();
      expect(screen.getAllByText('string')).toHaveLength(2);
      expect(screen.getByText('integer')).toBeInTheDocument();
    });

    it('falls back to "any" when a property has no declared type', async () => {
      renderCard(makeClusterResourceType(), {
        fetchResourceTypeSchema: jest.fn().mockResolvedValue({
          success: true,
          data: {
            type: 'object',
            properties: {
              extras: { description: 'untyped' },
            },
          },
        }),
      });

      await screen.findByText('Parameters (1)');
      expect(screen.getByText('extras')).toBeInTheDocument();
      expect(screen.getByText('any')).toBeInTheDocument();
    });

    it('flattens nested object properties with dot-path names', async () => {
      renderCard(makeClusterResourceType(), {
        fetchResourceTypeSchema: jest.fn().mockResolvedValue({
          success: true,
          data: {
            type: 'object',
            properties: {
              database: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  tls: { type: 'boolean' },
                },
              },
              replicas: { type: 'integer' },
            },
          },
        }),
      });

      expect(await screen.findByText('Parameters (3)')).toBeInTheDocument();
      expect(screen.getByText('database.name')).toBeInTheDocument();
      expect(screen.getByText('database.tls')).toBeInTheDocument();
      expect(screen.getByText('replicas')).toBeInTheDocument();
      // Parent "database" row should NOT appear when children expand.
      expect(screen.queryByText('database')).not.toBeInTheDocument();
    });

    it('preserves an empty nested object as a single row', async () => {
      renderCard(makeClusterResourceType(), {
        fetchResourceTypeSchema: jest.fn().mockResolvedValue({
          success: true,
          data: {
            type: 'object',
            properties: {
              config: { type: 'object' },
            },
          },
        }),
      });

      expect(await screen.findByText('Parameters (1)')).toBeInTheDocument();
      expect(screen.getByText('config')).toBeInTheDocument();
      expect(screen.getByText('object')).toBeInTheDocument();
    });

    it('renders array types as <element>[]', async () => {
      renderCard(makeClusterResourceType(), {
        fetchResourceTypeSchema: jest.fn().mockResolvedValue({
          success: true,
          data: {
            type: 'object',
            properties: {
              tags: { type: 'array', items: { type: 'string' } },
              ports: { type: 'array', items: { type: 'integer' } },
              opaque: { type: 'array' },
            },
          },
        }),
      });

      expect(await screen.findByText('Parameters (3)')).toBeInTheDocument();
      expect(screen.getByText('string[]')).toBeInTheDocument();
      expect(screen.getByText('integer[]')).toBeInTheDocument();
      expect(screen.getByText('any[]')).toBeInTheDocument();
    });

    it('renders an empty-state message when no properties are declared', async () => {
      renderCard(makeClusterResourceType(), {
        fetchResourceTypeSchema: jest
          .fn()
          .mockResolvedValue({ success: true, data: { properties: {} } }),
      });

      expect(await screen.findByText('Parameters (0)')).toBeInTheDocument();
      expect(screen.getByText('No parameters declared.')).toBeInTheDocument();
    });

    it('shows an error message when the schema fetch rejects', async () => {
      renderCard(makeClusterResourceType(), {
        fetchResourceTypeSchema: jest
          .fn()
          .mockRejectedValue(new Error('schema down')),
      });

      await waitFor(() => {
        expect(
          screen.getByText('Failed to load parameters: schema down'),
        ).toBeInTheDocument();
      });
    });
  });
});
