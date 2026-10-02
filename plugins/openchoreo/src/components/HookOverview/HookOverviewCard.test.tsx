import { render, screen } from '@testing-library/react';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { HookOverviewCard } from './HookOverviewCard';

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
  }),
}));

// EntityRefLink needs the catalog route ref; a plain anchor is enough here.
jest.mock('@backstage/plugin-catalog-react', () => ({
  ...jest.requireActual('@backstage/plugin-catalog-react'),
  EntityRefLink: ({ entityRef, title }: any) => (
    <a data-testid="workflow-link" href={`/${entityRef}`}>
      {title}
    </a>
  ),
}));

function makeClusterHook(overrides: Partial<Entity> = {}): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'ClusterHook',
    metadata: {
      name: 'trivy-image-scan',
      namespace: 'openchoreo-cluster',
      description: 'Scan images before production',
      annotations: { 'openchoreo.io/created-at': '2026-09-01T00:00:00Z' },
    },
    spec: {
      type: 'Workflow',
      workflowRef: { kind: 'ClusterWorkflow', name: 'trivy-image-scan' },
      enabledTo: [{ kind: 'ClusterComponentType', name: 'service' }],
      parameters: [
        { name: 'image', from: '${deployment.workload.containers.main.image}' },
        { name: 'severity', default: 'CRITICAL' },
        { name: 'registrySecret', value: 'harbor-pull' },
        {
          name: 'ignoreUnfixed',
          from: '${deployment.environment.isProduction}',
          overridable: true,
        },
        { name: 'ticket', required: true },
      ],
    },
    ...overrides,
  } as Entity;
}

// The parameter table is how a platform engineer verifies what a binding may
// override; a wrong source label would send them to edit the wrong side.
describe('HookOverviewCard', () => {
  it('labels every parameter source the way the webhook classifies it', () => {
    render(
      <EntityProvider entity={makeClusterHook()}>
        <HookOverviewCard />
      </EntityProvider>,
    );

    expect(screen.getByText('Cluster Hook Details')).toBeInTheDocument();
    expect(screen.getByText('from release')).toBeInTheDocument();
    expect(screen.getByText('default · overridable')).toBeInTheDocument();
    expect(screen.getByText('fixed')).toBeInTheDocument();
    expect(screen.getByText('from release · overridable')).toBeInTheDocument();
    expect(screen.getByText('required')).toBeInTheDocument();
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
  });

  it('links the workflow and lists enabledTo as chips', () => {
    render(
      <EntityProvider entity={makeClusterHook()}>
        <HookOverviewCard />
      </EntityProvider>,
    );

    const link = screen.getByTestId('workflow-link');
    expect(link).toHaveAttribute(
      'href',
      '/clusterworkflow:openchoreo-cluster/trivy-image-scan',
    );
    expect(
      screen.getByText('ClusterComponentType / service'),
    ).toBeInTheDocument();
  });

  it('says a hook without enabledTo applies to every component type', () => {
    const hook = makeClusterHook();
    (hook.spec as any).enabledTo = [];
    (hook.spec as any).parameters = [];
    render(
      <EntityProvider entity={hook}>
        <HookOverviewCard />
      </EntityProvider>,
    );

    expect(
      screen.getByText('Every component type (no restriction)'),
    ).toBeInTheDocument();
    expect(screen.getByText(/No parameters are mapped/)).toBeInTheDocument();
  });

  it('links a namespaced Hook to a namespaced Workflow in the same namespace', () => {
    const hook = makeClusterHook({
      kind: 'Hook',
      metadata: { name: 'smoke', namespace: 'finance' },
    } as Partial<Entity>);
    (hook.spec as any).workflowRef = { kind: 'Workflow', name: 'smoke-test' };
    render(
      <EntityProvider entity={hook}>
        <HookOverviewCard />
      </EntityProvider>,
    );
    expect(screen.getByText('Hook Details')).toBeInTheDocument();
    expect(screen.getByTestId('workflow-link')).toHaveAttribute(
      'href',
      '/workflow:finance/smoke-test',
    );
  });
});
