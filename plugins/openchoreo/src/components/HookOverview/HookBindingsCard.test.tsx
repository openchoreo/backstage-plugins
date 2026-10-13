import { render, screen, waitFor } from '@testing-library/react';
import { EntityProvider, catalogApiRef } from '@backstage/plugin-catalog-react';
import { TestApiProvider } from '@backstage/test-utils';
import type { Entity } from '@backstage/catalog-model';
import { HookBindingsCard, collectBindings } from './HookBindingsCard';

jest.mock('@openchoreo/backstage-design-system', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
}));

jest.mock('../DataplaneOverview/styles', () => ({
  useDataplaneOverviewStyles: () => ({
    card: '',
    cardHeader: '',
    statusItem: '',
    statusIcon: '',
  }),
}));

jest.mock('@backstage/plugin-catalog-react', () => ({
  ...jest.requireActual('@backstage/plugin-catalog-react'),
  EntityRefLink: ({ title }: any) => <span>{title}</span>,
}));

const clusterHook: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'ClusterHook',
  metadata: { name: 'trivy-image-scan', namespace: 'openchoreo-cluster' },
  spec: {},
};

const nsHook: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Hook',
  metadata: {
    name: 'smoke',
    namespace: 'finance',
    annotations: { 'openchoreo.io/namespace': 'finance' },
  },
  spec: {},
};

function environment(name: string, ns: string, hooks?: unknown): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Environment',
    metadata: {
      name,
      namespace: ns,
      annotations: { 'openchoreo.io/namespace': ns },
    },
    spec: { type: 'production', ...(hooks ? { hooks } : {}) },
  };
}

const scanAndSmoke = {
  preDeploy: [
    {
      name: 'image-scan',
      hookRef: { kind: 'ClusterHook', name: 'trivy-image-scan' },
      mode: 'Sync',
      onFailure: 'Block',
    },
  ],
  postDeploy: [{ name: 'smoke', hookRef: { name: 'smoke' }, mode: 'Async' }],
};

// A platform engineer reads this card to learn where a hook is enforced; a
// binding attributed to the wrong hook (same name, other kind or namespace)
// would misreport the blast radius of an edit.
describe('collectBindings', () => {
  it('matches a ClusterHook across namespaces and only by ClusterHook kind', () => {
    const rows = collectBindings(clusterHook, [
      environment('production', 'default', scanAndSmoke),
      environment('production', 'finance', scanAndSmoke),
      environment('development', 'default'),
    ]);
    expect(rows.map(r => r.environmentRef)).toEqual([
      'environment:default/production',
      'environment:finance/production',
    ]);
    expect(rows.every(r => r.phase === 'preDeploy')).toBe(true);
  });

  it('matches a namespaced Hook only in its own namespace and defaults hookRef.kind to Hook', () => {
    const rows = collectBindings(nsHook, [
      environment('production', 'default', scanAndSmoke),
      environment('production', 'finance', scanAndSmoke),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].environmentRef).toBe('environment:finance/production');
    expect(rows[0].phase).toBe('postDeploy');
    expect(rows[0].binding.mode).toBe('Async');
  });
});

describe('HookBindingsCard', () => {
  it('renders bindings with the phase defaults filled in', async () => {
    const catalogApi = {
      getEntities: jest.fn().mockResolvedValue({
        items: [environment('production', 'default', scanAndSmoke)],
      }),
    };
    render(
      <TestApiProvider apis={[[catalogApiRef, catalogApi as any]]}>
        <EntityProvider entity={clusterHook}>
          <HookBindingsCard />
        </EntityProvider>
      </TestApiProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText('production')).toBeInTheDocument(),
    );
    expect(catalogApi.getEntities).toHaveBeenCalledWith({
      filter: { kind: 'Environment' },
    });
    expect(screen.getByText('pre-deploy · image-scan')).toBeInTheDocument();
    expect(screen.getByText('Block')).toBeInTheDocument();
  });

  it('shows the empty state when nothing binds the hook', async () => {
    const catalogApi = {
      getEntities: jest.fn().mockResolvedValue({ items: [] }),
    };
    render(
      <TestApiProvider apis={[[catalogApiRef, catalogApi as any]]}>
        <EntityProvider entity={clusterHook}>
          <HookBindingsCard />
        </EntityProvider>
      </TestApiProvider>,
    );
    await waitFor(() =>
      expect(
        screen.getByText('Not bound by any environment yet'),
      ).toBeInTheDocument(),
    );
  });
});
