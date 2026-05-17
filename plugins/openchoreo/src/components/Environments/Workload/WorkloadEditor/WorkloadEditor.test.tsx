import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { mockComponentEntity } from '@openchoreo/test-utils';
import type { WorkloadResource } from '@openchoreo/backstage-plugin-common';
import { WorkloadEditor } from './WorkloadEditor';

// ---- Mocks ----

// useWorkloadContext: controllable workload state + spy on setWorkloadResource.
const setWorkloadResourceSpy = jest.fn();
const mockUseWorkloadContext = jest.fn();
jest.mock('../WorkloadContext', () => ({
  useWorkloadContext: () => mockUseWorkloadContext(),
}));

// openchoreo-react: hooks + YamlEditor stub.
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useSecretReferences: () => ({ secretReferences: [] }),
  filterSecretReferencesForEnvDataPlane: (refs: unknown[]) => refs,
  useUrlSyncedTab: ({ initialTab, defaultTab }: any) => {
    // Simple stub: state-less, returns initialTab/defaultTab. Tests that
    // need to switch tabs do so via the initialTab prop instead.
    return [initialTab ?? defaultTab, jest.fn()];
  },
  YamlEditor: (_: any) => <div data-testid="yaml-editor" />,
}));

// design-system: trivial stubs.
jest.mock('@openchoreo/backstage-design-system', () => ({
  FormYamlToggle: (props: any) => (
    <button
      data-testid="form-yaml-toggle"
      type="button"
      onClick={() => props.onChange?.(props.value === 'yaml' ? 'form' : 'yaml')}
    >
      {props.value}
    </button>
  ),
  VerticalTabNav: (props: any) => (
    <div data-testid="vertical-tab-nav">
      {(props.tabs ?? []).map((t: any) => (
        <button
          key={t.id}
          type="button"
          data-testid={`outer-tab-${t.id}`}
          onClick={() => props.onChange?.(t.id)}
        >
          {t.label}
        </button>
      ))}
      <div>{props.children}</div>
    </div>
  ),
  TabItemData: undefined,
}));

// Child content components: expose handler props as click-able stubs so tests
// can trigger the parent's handlers without rendering the real editors.
jest.mock('./ContainerContent', () => ({
  ContainerContent: () => <div data-testid="container-content" />,
}));

jest.mock('./EndpointContent', () => ({
  EndpointContent: () => <div data-testid="endpoint-content" />,
}));

jest.mock('./DependencyContent', () => ({
  DependencyContent: (props: any) => (
    <div data-testid="dependency-content">
      <div data-testid="dependency-content-endpoint-count">
        {(props.dependencies ?? []).length}
      </div>
      <div data-testid="dependency-content-resource-count">
        {(props.resources ?? []).length}
      </div>
      <button
        type="button"
        data-testid="trigger-add-dependency"
        onClick={() => props.onAddDependency?.()}
      >
        add dependency
      </button>
      <button
        type="button"
        data-testid="trigger-replace-dependency-0"
        onClick={() =>
          props.onDependencyReplace?.(0, {
            component: 'svc',
            name: 'ep',
            visibility: 'project',
            envBindings: { address: 'NEW_ADDR' },
          })
        }
      >
        replace first dependency
      </button>
      <button
        type="button"
        data-testid="trigger-remove-dependency-0"
        onClick={() => props.onRemoveDependency?.(0)}
      >
        remove first dependency
      </button>
      <button
        type="button"
        data-testid="trigger-add-resource-dependency"
        onClick={() => props.onAddResourceDependency?.('orders-db')}
      >
        add resource dependency
      </button>
      <button
        type="button"
        data-testid="trigger-replace-resource-dependency-0"
        onClick={() =>
          props.onResourceDependencyReplace?.(0, {
            ref: 'orders-db',
            envBindings: { host: 'NEW_DB_HOST' },
          })
        }
      >
        replace first resource dependency
      </button>
      <button
        type="button"
        data-testid="trigger-remove-resource-dependency-0"
        onClick={() => props.onRemoveResourceDependency?.(0)}
      >
        remove first resource dependency
      </button>
    </div>
  ),
}));

jest.mock('./TraitsContent', () => ({
  TraitsContent: () => <div data-testid="traits-content" />,
}));

jest.mock('./ParametersContent', () => ({
  ParametersContent: () => <div data-testid="parameters-content" />,
}));

// ---- Helpers ----

const testEntity = mockComponentEntity();

function buildWorkload(spec: Record<string, unknown>): WorkloadResource {
  return {
    apiVersion: 'openchoreo.dev/v1alpha1',
    kind: 'Workload',
    metadata: { name: 'orders-api', namespace: 'default' },
    spec,
  } as unknown as WorkloadResource;
}

function renderEditor(workloadResource: WorkloadResource | null) {
  mockUseWorkloadContext.mockReturnValue({
    workloadResource,
    setWorkloadResource: setWorkloadResourceSpy,
    isDeploying: false,
  });
  return render(
    <MemoryRouter>
      <EntityProvider entity={testEntity}>
        <WorkloadEditor initialTab="dependencies" />
      </EntityProvider>
    </MemoryRouter>,
  );
}

function lastSetSpec(): Record<string, any> {
  expect(setWorkloadResourceSpy).toHaveBeenCalled();
  const lastCall =
    setWorkloadResourceSpy.mock.calls[
      setWorkloadResourceSpy.mock.calls.length - 1
    ];
  return lastCall[0].spec;
}

// ---- Tests ----

describe('WorkloadEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('mounts the dependencies tab', () => {
    renderEditor(buildWorkload({ container: { image: 'nginx:1' } }));
    expect(screen.getByTestId('dependency-content')).toBeInTheDocument();
  });

  it('passes both endpoint and resource dependencies down to DependencyContent', () => {
    renderEditor(
      buildWorkload({
        container: { image: 'nginx:1' },
        dependencies: {
          endpoints: [
            {
              component: 'payments-svc',
              name: 'orders',
              visibility: 'project',
              envBindings: { address: 'PAYMENTS_ADDR' },
            },
          ],
          resources: [{ ref: 'orders-db', envBindings: { host: 'DB_HOST' } }],
        },
      }),
    );

    expect(
      screen.getByTestId('dependency-content-endpoint-count').textContent,
    ).toBe('1');
    expect(
      screen.getByTestId('dependency-content-resource-count').textContent,
    ).toBe('1');
  });

  describe('dependencies.resources preservation when endpoints are edited', () => {
    const workloadWithResources = () =>
      buildWorkload({
        container: { image: 'nginx:1' },
        dependencies: {
          resources: [
            {
              ref: 'orders-db',
              envBindings: { host: 'DB_HOST', password: 'DB_PASSWORD' },
              fileBindings: { password: '/etc/db/password' },
            },
            {
              ref: 'orders-cache',
              envBindings: { host: 'REDIS_HOST' },
            },
          ],
        },
      });

    const originalResources = [
      {
        ref: 'orders-db',
        envBindings: { host: 'DB_HOST', password: 'DB_PASSWORD' },
        fileBindings: { password: '/etc/db/password' },
      },
      {
        ref: 'orders-cache',
        envBindings: { host: 'REDIS_HOST' },
      },
    ];

    it('preserves dependencies.resources when an endpoint dependency is added', () => {
      renderEditor(workloadWithResources());

      fireEvent.click(screen.getByTestId('trigger-add-dependency'));

      const spec = lastSetSpec();
      expect(spec.dependencies?.resources).toEqual(originalResources);
      expect(spec.dependencies?.endpoints).toHaveLength(1);
    });

    it('preserves dependencies.resources when an endpoint dependency is replaced', () => {
      const workload = buildWorkload({
        container: { image: 'nginx:1' },
        dependencies: {
          endpoints: [
            {
              component: 'old-svc',
              name: 'old-ep',
              visibility: 'project',
              envBindings: { address: 'OLD_ADDR' },
            },
          ],
          resources: originalResources,
        },
      });
      renderEditor(workload);

      fireEvent.click(screen.getByTestId('trigger-replace-dependency-0'));

      const spec = lastSetSpec();
      expect(spec.dependencies?.resources).toEqual(originalResources);
      expect(spec.dependencies?.endpoints).toHaveLength(1);
      expect(spec.dependencies?.endpoints?.[0]).toMatchObject({
        component: 'svc',
        name: 'ep',
        envBindings: { address: 'NEW_ADDR' },
      });
    });

    it('preserves dependencies.resources when an endpoint dependency is removed', () => {
      const workload = buildWorkload({
        container: { image: 'nginx:1' },
        dependencies: {
          endpoints: [
            {
              component: 'svc',
              name: 'ep',
              visibility: 'project',
              envBindings: { address: 'OLD_ADDR' },
            },
          ],
          resources: originalResources,
        },
      });
      renderEditor(workload);

      fireEvent.click(screen.getByTestId('trigger-remove-dependency-0'));

      const spec = lastSetSpec();
      expect(spec.dependencies?.resources).toEqual(originalResources);
      expect(spec.dependencies?.endpoints).toEqual([]);
    });

    it('still updates endpoints when no resources are present (happy path unchanged)', () => {
      const workload = buildWorkload({
        container: { image: 'nginx:1' },
        endpoints: { http: { port: 80, type: 'HTTP' } },
      });
      renderEditor(workload);

      fireEvent.click(screen.getByTestId('trigger-add-dependency'));

      const spec = lastSetSpec();
      expect(spec.dependencies?.endpoints).toHaveLength(1);
      expect(spec.dependencies?.resources).toBeUndefined();
    });
  });

  describe('dependencies.endpoints preservation when resources are edited', () => {
    const endpointDep = {
      component: 'payments-svc',
      name: 'orders',
      visibility: 'project',
      envBindings: { address: 'PAYMENTS_ADDR' },
    };

    it('preserves dependencies.endpoints when a resource dependency is added', () => {
      renderEditor(
        buildWorkload({
          container: { image: 'nginx:1' },
          dependencies: { endpoints: [endpointDep] },
        }),
      );

      fireEvent.click(screen.getByTestId('trigger-add-resource-dependency'));

      const spec = lastSetSpec();
      expect(spec.dependencies?.endpoints).toEqual([endpointDep]);
      expect(spec.dependencies?.resources).toEqual([{ ref: 'orders-db' }]);
    });

    it('preserves dependencies.endpoints when a resource dependency is replaced', () => {
      renderEditor(
        buildWorkload({
          container: { image: 'nginx:1' },
          dependencies: {
            endpoints: [endpointDep],
            resources: [{ ref: 'orders-db', envBindings: { host: 'OLD' } }],
          },
        }),
      );

      fireEvent.click(
        screen.getByTestId('trigger-replace-resource-dependency-0'),
      );

      const spec = lastSetSpec();
      expect(spec.dependencies?.endpoints).toEqual([endpointDep]);
      expect(spec.dependencies?.resources).toEqual([
        { ref: 'orders-db', envBindings: { host: 'NEW_DB_HOST' } },
      ]);
    });

    it('preserves dependencies.endpoints when a resource dependency is removed', () => {
      renderEditor(
        buildWorkload({
          container: { image: 'nginx:1' },
          dependencies: {
            endpoints: [endpointDep],
            resources: [{ ref: 'orders-db' }],
          },
        }),
      );

      fireEvent.click(
        screen.getByTestId('trigger-remove-resource-dependency-0'),
      );

      const spec = lastSetSpec();
      expect(spec.dependencies?.endpoints).toEqual([endpointDep]);
      expect(spec.dependencies?.resources).toEqual([]);
    });
  });
});
