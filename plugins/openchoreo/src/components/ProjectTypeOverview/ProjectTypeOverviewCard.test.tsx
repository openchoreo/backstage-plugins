import { render, screen, waitFor } from '@testing-library/react';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { TestApiProvider } from '@backstage/test-utils';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import { ProjectTypeOverviewCard } from './ProjectTypeOverviewCard';

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

function makeClusterProjectType(overrides: Partial<Entity> = {}): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'ClusterProjectType',
    metadata: {
      name: 'standard',
      namespace: 'openchoreo-cluster',
      annotations: {
        'openchoreo.io/created-at': '2026-05-01T00:00:00Z',
      },
    },
    spec: {},
    ...overrides,
  } as Entity;
}

function makeProjectType(overrides: Partial<Entity> = {}): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'ProjectType',
    metadata: {
      name: 'web-service',
      namespace: 'finance',
      annotations: {
        'openchoreo.io/created-at': '2026-05-01T00:00:00Z',
        'openchoreo.io/namespace': 'finance',
      },
    },
    spec: {},
    ...overrides,
  } as Entity;
}

function renderCard(entity: Entity, getResourceDefinition?: jest.Mock) {
  const client = {
    getResourceDefinition:
      getResourceDefinition ?? jest.fn().mockResolvedValue({ spec: {} }),
  };
  const utils = render(
    <TestApiProvider apis={[[openChoreoClientApiRef, client as any]]}>
      <EntityProvider entity={entity}>
        <ProjectTypeOverviewCard />
      </EntityProvider>
    </TestApiProvider>,
  );
  return { ...utils, client };
}

describe('ProjectTypeOverviewCard', () => {
  describe('title', () => {
    it('renders "ClusterProjectType Details" for a ClusterProjectType entity', async () => {
      renderCard(makeClusterProjectType());
      expect(
        await screen.findByText('ClusterProjectType Details'),
      ).toBeInTheDocument();
    });

    it('renders "ProjectType Details" for a ProjectType entity', async () => {
      renderCard(makeProjectType());
      expect(
        await screen.findByText('ProjectType Details'),
      ).toBeInTheDocument();
    });
  });

  describe('client request', () => {
    it('fetches the namespaced definition with the resolved namespace', async () => {
      const getResourceDefinition = jest.fn().mockResolvedValue({ spec: {} });
      renderCard(makeProjectType(), getResourceDefinition);

      await screen.findByText('ProjectType Details');
      expect(getResourceDefinition).toHaveBeenCalledWith(
        'projecttypes',
        'finance',
        'web-service',
      );
    });

    it('fetches the cluster definition with an empty namespace', async () => {
      const getResourceDefinition = jest.fn().mockResolvedValue({ spec: {} });
      renderCard(makeClusterProjectType(), getResourceDefinition);

      await screen.findByText('ClusterProjectType Details');
      expect(getResourceDefinition).toHaveBeenCalledWith(
        'clusterprojecttypes',
        '',
        'standard',
      );
    });
  });

  describe('Created date', () => {
    it('renders a formatted Created date when the annotation is present', async () => {
      renderCard(makeClusterProjectType());
      expect(await screen.findByText('Created')).toBeInTheDocument();
      expect(screen.getByText(/2026/)).toBeInTheDocument();
    });

    it('hides the Created row when the annotation is absent', async () => {
      renderCard(
        makeClusterProjectType({
          metadata: { name: 'standard', namespace: 'openchoreo-cluster' },
        }),
      );
      await screen.findByText('ClusterProjectType Details');
      expect(screen.queryByText('Created')).not.toBeInTheDocument();
    });
  });

  describe('Parameters section', () => {
    it('renders one row per top-level property with name and type', async () => {
      renderCard(
        makeClusterProjectType(),
        jest.fn().mockResolvedValue({
          spec: {
            parameters: {
              openAPIV3Schema: {
                type: 'object',
                properties: {
                  region: { type: 'string' },
                  replicas: { type: 'integer' },
                },
              },
            },
          },
        }),
      );

      expect(await screen.findByText('Parameters (2)')).toBeInTheDocument();
      expect(screen.getByText('region')).toBeInTheDocument();
      expect(screen.getByText('replicas')).toBeInTheDocument();
      expect(screen.getByText('string')).toBeInTheDocument();
      expect(screen.getByText('integer')).toBeInTheDocument();
    });

    it('flattens nested object properties with dot-path names', async () => {
      renderCard(
        makeClusterProjectType(),
        jest.fn().mockResolvedValue({
          spec: {
            parameters: {
              openAPIV3Schema: {
                type: 'object',
                properties: {
                  network: {
                    type: 'object',
                    properties: { cidr: { type: 'string' } },
                  },
                },
              },
            },
          },
        }),
      );

      expect(await screen.findByText('Parameters (1)')).toBeInTheDocument();
      expect(screen.getByText('network.cidr')).toBeInTheDocument();
    });

    it('renders array types as <element>[]', async () => {
      renderCard(
        makeClusterProjectType(),
        jest.fn().mockResolvedValue({
          spec: {
            parameters: {
              openAPIV3Schema: {
                type: 'object',
                properties: {
                  zones: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        }),
      );

      expect(await screen.findByText('Parameters (1)')).toBeInTheDocument();
      expect(screen.getByText('string[]')).toBeInTheDocument();
    });

    it('renders an empty-state message when no parameters are declared', async () => {
      renderCard(makeClusterProjectType());
      expect(await screen.findByText('Parameters (0)')).toBeInTheDocument();
      expect(
        await screen.findByText('Environment Configs (0)'),
      ).toBeInTheDocument();
      // Both schema sections share the "None declared." empty state.
      expect(screen.getAllByText('None declared.')).toHaveLength(2);
    });
  });

  describe('Environment Configs section', () => {
    it('renders env-config schema properties', async () => {
      renderCard(
        makeClusterProjectType(),
        jest.fn().mockResolvedValue({
          spec: {
            environmentConfigs: {
              openAPIV3Schema: {
                type: 'object',
                properties: { tier: { type: 'string' } },
              },
            },
          },
        }),
      );

      expect(
        await screen.findByText('Environment Configs (1)'),
      ).toBeInTheDocument();
      expect(screen.getByText('tier')).toBeInTheDocument();
    });
  });

  describe('Resources section', () => {
    it('renders one row per resource template', async () => {
      renderCard(
        makeClusterProjectType(),
        jest.fn().mockResolvedValue({
          spec: {
            resources: [{ id: 'cell-namespace' }, { id: 'network-policy' }],
          },
        }),
      );

      expect(await screen.findByText('Resources (2)')).toBeInTheDocument();
      expect(screen.getByText('cell-namespace')).toBeInTheDocument();
      expect(screen.getByText('network-policy')).toBeInTheDocument();
    });

    it('falls back to resource-<index> when a template has no id', async () => {
      renderCard(
        makeClusterProjectType(),
        jest.fn().mockResolvedValue({ spec: { resources: [{}] } }),
      );

      expect(await screen.findByText('Resources (1)')).toBeInTheDocument();
      expect(screen.getByText('resource-0')).toBeInTheDocument();
    });

    it('renders an empty-state message when no resources are declared', async () => {
      renderCard(makeClusterProjectType());
      expect(await screen.findByText('Resources (0)')).toBeInTheDocument();
      expect(
        screen.getByText('No resource templates declared.'),
      ).toBeInTheDocument();
    });
  });

  describe('Validations section', () => {
    it('renders a row per validation, preferring message over rule', async () => {
      renderCard(
        makeClusterProjectType(),
        jest.fn().mockResolvedValue({
          spec: {
            validations: [
              { rule: 'a == b', message: 'a must equal b' },
              { rule: 'c > 0' },
            ],
          },
        }),
      );

      expect(await screen.findByText('Validations (2)')).toBeInTheDocument();
      expect(screen.getByText('a must equal b')).toBeInTheDocument();
      expect(screen.getByText('c > 0')).toBeInTheDocument();
    });

    it('renders an empty-state message when no validations are declared', async () => {
      renderCard(makeClusterProjectType());
      expect(await screen.findByText('Validations (0)')).toBeInTheDocument();
      expect(
        screen.getByText('No validation rules declared.'),
      ).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('shows an error message when the fetch rejects', async () => {
      renderCard(
        makeClusterProjectType(),
        jest.fn().mockRejectedValue(new Error('definition down')),
      );

      await waitFor(() => {
        expect(
          screen.getByText(
            'Failed to load project type details: definition down',
          ),
        ).toBeInTheDocument();
      });
    });
  });
});
