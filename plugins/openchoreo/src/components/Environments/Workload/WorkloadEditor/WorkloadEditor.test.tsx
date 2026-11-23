import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { mockComponentEntity } from '@openchoreo/test-utils';
import type { WorkloadResource } from '@openchoreo/backstage-plugin-common';
import { WorkloadEditor } from './WorkloadEditor';

// ---- Mocks ----

// useWorkloadContext: controllable workload state + spy on setWorkloadResource.
const setWorkloadResourceSpy = jest.fn();
const setEditingSectionSpy = jest.fn();
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
  YamlEditor: (props: any) => (
    <textarea
      data-testid="yaml-editor"
      value={props.content}
      onChange={e => props.onChange?.(e.target.value)}
    />
  ),
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
    setEditingSection: setEditingSectionSpy,
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

describe('YAML tabs for the Endpoints', () => {
  const setChoice = jest.fn();
  const componentEndpoints = {
    loading: false,
    loadError: null,
    allowedEndpoints: [
      {
        protocols: ['HTTP'],
        ref: { kind: 'ClusterEndpointType', name: 'http-route' },
        default: true,
      },
    ],
    originals: [
      {
        name: 'orders-api',
        releaseLine: '',
        workloadEndpoint: 'api',
        typeKind: 'ClusterEndpointType' as const,
        typeName: 'http-route',
        visibility: ['external'],
        parameters: {},
        autoDeploy: true,
      },
    ],
    draftedFromMain: 0,
    choices: { api: { type: 'ClusterEndpointType/http-route' } },
    renames: {},
    mode: 'endpoints' as const,
    deprecatedRows: {},
    setChoice,
    restoreChoice: jest.fn(),
    renameWorkloadEndpoint: jest.fn(),
    prepare: (e: any) => e,
    apply: jest.fn(),
  };

  function renderWithEndpoints(
    endpoints: Record<string, unknown> = {
      api: { type: 'HTTP', port: 8080, visibility: ['external'] },
    },
  ) {
    mockUseWorkloadContext.mockReturnValue({
      workloadResource: buildWorkload({ endpoints }),
      setWorkloadResource: setWorkloadResourceSpy,
      setEditingSection: setEditingSectionSpy,
      isDeploying: false,
    });
    render(
      <MemoryRouter>
        <EntityProvider entity={testEntity}>
          <WorkloadEditor
            initialTab="endpoints"
            componentEndpoints={componentEndpoints}
          />
        </EntityProvider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('form-yaml-toggle'));
  }

  beforeEach(() => {
    setChoice.mockClear();
    setWorkloadResourceSpy.mockClear();
    setEditingSectionSpy.mockClear();
  });

  it('shows a Workload tab and one tab per Endpoint', () => {
    renderWithEndpoints();

    expect(screen.getByRole('tab', { name: 'Workload' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.getByRole('tab', { name: 'Endpoint: orders-api' }),
    ).toBeInTheDocument();
    expect(
      (screen.getByTestId('yaml-editor') as HTMLTextAreaElement).value,
    ).toContain('kind: Workload');
  });

  it("edits an Endpoint's visibility and parameters from its tab", () => {
    renderWithEndpoints();
    fireEvent.click(screen.getByRole('tab', { name: 'Endpoint: orders-api' }));

    const editor = screen.getByTestId('yaml-editor') as HTMLTextAreaElement;
    expect(editor.value).toContain('kind: Endpoint');
    fireEvent.change(editor, {
      target: {
        value: editor.value
          .replace('- external', '- internal')
          .replace(
            'backendRefs:',
            'parameters:\n    pathPrefix: /v2\n  backendRefs:',
          ),
      },
    });

    expect(setChoice).toHaveBeenCalledWith('api', {
      type: 'ClusterEndpointType/http-route',
      parameters: { pathPrefix: '/v2' },
    });
    const saved = setWorkloadResourceSpy.mock.calls.at(-1)?.[0];
    expect(saved.spec.endpoints.api.visibility).toEqual(['internal']);
  });

  it('opens a new Endpoint as a YAML template and holds Save until it is complete', () => {
    renderWithEndpoints();
    fireEvent.click(screen.getByRole('button', { name: /Add Endpoint/ }));

    expect(screen.getByRole('tab', { name: /New Endpoint/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const editor = screen.getByTestId('yaml-editor') as HTMLTextAreaElement;
    expect(editor.value).toContain('kind: Endpoint');
    expect(editor.value).toContain('endpoint: <workload-endpoint>');
    expect(setEditingSectionSpy).toHaveBeenCalledWith('endpointYaml', true);
  });

  it('says what a new Endpoint still needs', () => {
    renderWithEndpoints();
    fireEvent.click(screen.getByRole('button', { name: /Add Endpoint/ }));
    const editor = screen.getByTestId('yaml-editor') as HTMLTextAreaElement;
    fireEvent.change(editor, {
      target: {
        value: editor.value.replace('<workload-endpoint>', 'missing'),
      },
    });

    expect(
      screen.getByText(/Workload endpoint missing isn't in the Workload tab/),
    ).toBeInTheDocument();
    expect(setChoice).not.toHaveBeenCalled();
  });

  it('stages a new Endpoint once it names a free workload endpoint', () => {
    renderWithEndpoints({
      api: { type: 'HTTP', port: 8080, visibility: ['external'] },
      web: { type: 'HTTP', port: 9090, visibility: ['project'] },
    });
    fireEvent.click(screen.getByRole('button', { name: /Add Endpoint/ }));
    const editor = screen.getByTestId('yaml-editor') as HTMLTextAreaElement;
    expect(screen.getByText(/without an Endpoint: web/)).toBeInTheDocument();
    fireEvent.change(editor, {
      target: {
        value: editor.value
          .replace('<workload-endpoint>', 'web')
          .replace('- project', '- external'),
      },
    });

    expect(setChoice).toHaveBeenCalledWith('web', {
      type: 'ClusterEndpointType/http-route',
      parameters: {},
    });
    const saved = setWorkloadResourceSpy.mock.calls.at(-1)?.[0];
    expect(saved.spec.endpoints.web.visibility).toEqual(['external']);
  });

  it("removes only the Endpoint with its tab's ✕", () => {
    const restoreChoice = componentEndpoints.restoreChoice as jest.Mock;
    restoreChoice.mockClear();
    renderWithEndpoints();
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Endpoint: orders-api' }),
    );

    const saved = setWorkloadResourceSpy.mock.calls.at(-1)?.[0];
    expect(saved.spec.endpoints.api).toEqual({
      type: 'HTTP',
      port: 8080,
      visibility: ['project'],
    });
    expect(restoreChoice).toHaveBeenCalledWith('api', undefined);
  });

  it('holds a workload endpoint that has no fields yet as invalid YAML', () => {
    renderWithEndpoints();
    const editor = screen.getByTestId('yaml-editor') as HTMLTextAreaElement;
    setWorkloadResourceSpy.mockClear();

    fireEvent.change(editor, {
      target: {
        value: editor.value.replace('endpoints:', 'endpoints:\n    admin:'),
      },
    });

    expect(setWorkloadResourceSpy).not.toHaveBeenCalled();
    expect(screen.getAllByText('Invalid YAML').length).toBeGreaterThan(0);
  });

  it('refreshes the Workload YAML when an Endpoint is removed from it', () => {
    renderWithEndpoints();
    const editor = screen.getByTestId('yaml-editor') as HTMLTextAreaElement;
    expect(editor.value).toContain('- external');

    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Endpoint: orders-api' }),
    );

    expect(editor.value).not.toContain('- external');
    expect(editor.value).toContain('- project');
  });

  it('keeps an Endpoint while the Workload YAML has errors', () => {
    renderWithEndpoints();
    const editor = screen.getByTestId('yaml-editor') as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: 'spec: [' } });
    setWorkloadResourceSpy.mockClear();

    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Endpoint: orders-api' }),
    );

    expect(setWorkloadResourceSpy).not.toHaveBeenCalled();
    expect(
      screen.getAllByText('Fix YAML errors before removing an Endpoint').length,
    ).toBeGreaterThan(0);
    expect(editor.value).toBe('spec: [');
  });

  it("refuses changes to an Endpoint's fixed fields", () => {
    renderWithEndpoints();
    fireEvent.click(screen.getByRole('tab', { name: 'Endpoint: orders-api' }));

    const editor = screen.getByTestId('yaml-editor') as HTMLTextAreaElement;
    fireEvent.change(editor, {
      target: { value: editor.value.replace('orders-api', 'renamed') },
    });

    expect(
      screen.getAllByText(
        /Only spec.visibility and spec.parameters can be changed/,
      ).length,
    ).toBeGreaterThan(0);
    expect(setChoice).not.toHaveBeenCalled();
  });
});
