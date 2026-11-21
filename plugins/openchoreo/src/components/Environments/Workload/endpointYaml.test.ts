import type { ComponentEndpointSummary } from '@openchoreo/backstage-plugin-common';
import type { ComponentEndpointsState } from './hooks/useComponentEndpoints';
import {
  endpointToYaml,
  endpointYamlTabs,
  newEndpointTemplate,
  parseEndpointYaml,
} from './endpointYaml';

const ROUTE = 'ClusterEndpointType/http-route';
const context = {
  componentName: 'orders',
  projectName: 'shop',
  namespaceName: 'acme',
};

const original: ComponentEndpointSummary = {
  name: 'orders-api',
  releaseLine: '',
  workloadEndpoint: 'api',
  typeKind: 'ClusterEndpointType',
  typeName: 'http-route',
  visibility: ['external'],
  parameters: { pathPrefix: '/orders' },
  autoDeploy: false,
};

function state(
  overrides: Partial<ComponentEndpointsState> = {},
): ComponentEndpointsState {
  return {
    loading: false,
    loadError: null,
    allowedEndpoints: [
      {
        protocols: ['HTTP'],
        ref: { kind: 'ClusterEndpointType', name: 'http-route' },
        default: true,
      },
    ],
    originals: [],
    draftedFromMain: 0,
    choices: {},
    renames: {},
    mode: 'endpoints',
    deprecatedRows: {},
    canUseEndpoints: true,
    setChoice: jest.fn(),
    restoreChoice: jest.fn(),
    renameWorkloadEndpoint: jest.fn(),
    prepare: endpoints => endpoints,
    apply: jest.fn(),
    ...overrides,
  };
}

describe('endpointYamlTabs', () => {
  it('shows an existing Endpoint with the edits on the page', () => {
    const [tab] = endpointYamlTabs(
      { api: { protocol: 'HTTP', visibility: ['project', 'external'] } },
      state({
        originals: [original],
        choices: { api: { type: ROUTE, parameters: { pathPrefix: '/v2' } } },
      }),
      context,
    );

    expect(tab.label).toBe('orders-api');
    expect(tab.resource).toEqual({
      apiVersion: 'openchoreo.dev/v1alpha1',
      kind: 'Endpoint',
      metadata: { name: 'orders-api', namespace: 'acme' },
      spec: {
        owner: { projectName: 'shop', componentName: 'orders' },
        type: { kind: 'ClusterEndpointType', name: 'http-route' },
        visibility: ['project', 'external'],
        backendRefs: [
          {
            name: 'orders-api',
            kind: 'Component',
            component: { name: 'orders', endpoint: 'api' },
          },
        ],
        parameters: { pathPrefix: '/v2' },
        autoDeploy: false,
      },
    });
  });

  it('shows a new Endpoint by the name it is created with, without autoDeploy', () => {
    const [tab] = endpointYamlTabs(
      { 'endpoint-1': { protocol: 'HTTP', visibility: ['project'] } },
      state({
        choices: { 'endpoint-1': { type: ROUTE } },
        releaseLine: 'canary',
      }),
      context,
    );

    expect(tab.label).toBe('endpoint-1 (new)');
    expect(tab.resource).toMatchObject({
      metadata: { name: 'orders-canary-endpoint-1' },
      spec: {
        owner: { componentName: 'orders', releaseLineName: 'canary' },
        visibility: ['project'],
      },
    });
    expect(tab.resource.spec).not.toHaveProperty('autoDeploy');
  });

  it('leaves out workload endpoints without an Endpoint, and the legacy form', () => {
    const endpoints = {
      untyped: { protocol: 'HTTP', visibility: ['project'] },
      none: { protocol: 'HTTP', visibility: [] },
    };
    expect(
      endpointYamlTabs(
        endpoints,
        state({ choices: { none: { type: ROUTE } } }),
        context,
      ),
    ).toEqual([]);
    expect(
      endpointYamlTabs(
        { api: { protocol: 'HTTP', visibility: ['external'] } },
        state({ mode: 'legacy', choices: { api: { type: ROUTE } } }),
        context,
      ),
    ).toEqual([]);
  });
});

describe('parseEndpointYaml', () => {
  const [tab] = endpointYamlTabs(
    { api: { protocol: 'HTTP', visibility: ['external'] } },
    state({ originals: [original], choices: { api: { type: ROUTE } } }),
    context,
  );
  const yaml = endpointToYaml(tab.resource);

  it('reads the visibility and parameters', () => {
    const edited = yaml
      .replace('- external', '- project\n    - internal')
      .replace(
        'backendRefs:',
        'parameters:\n    pathPrefix: /v3\n  backendRefs:',
      );

    expect(parseEndpointYaml(edited, tab.resource)).toEqual({
      visibility: ['project', 'internal'],
      parameters: { pathPrefix: '/v3' },
    });
  });

  it('reads an unchanged Endpoint back as it is', () => {
    expect(parseEndpointYaml(yaml, tab.resource)).toEqual({
      visibility: ['external'],
      parameters: {},
    });
  });

  it('refuses changes to the fields the form sets', () => {
    const edited = yaml.replace('name: orders-api', 'name: renamed');
    expect(parseEndpointYaml(edited, tab.resource)).toEqual({
      error: expect.stringMatching(/Only spec.visibility and spec.parameters/),
    });
  });

  it('refuses an empty or unknown visibility', () => {
    expect(
      parseEndpointYaml(yaml.replace('- external', '[]'), tab.resource),
    ).toEqual({ error: expect.stringMatching(/spec.visibility must list/) });
    expect(
      parseEndpointYaml(yaml.replace('- external', '- public'), tab.resource),
    ).toEqual({ error: expect.stringMatching(/spec.visibility must list/) });
  });

  it('reports invalid YAML', () => {
    expect(parseEndpointYaml('spec: [', tab.resource)).toEqual({
      error: expect.stringMatching(/^Invalid YAML/),
    });
  });

  it('reports an alias that refers back to itself', () => {
    const edited = yaml.replace(
      'backendRefs:',
      'parameters: &p\n    self: *p\n  backendRefs:',
    );
    expect(parseEndpointYaml(edited, tab.resource)).toEqual({
      error: expect.stringMatching(/alias refers back to itself/),
    });
  });
});

describe('new Endpoints in YAML', () => {
  const allowedEndpoints = state().allowedEndpoints;
  const template = newEndpointTemplate(state(), context, undefined);
  const yaml = endpointToYaml(template);
  const rules = {
    isNew: true,
    allowedEndpoints,
    freeWorkloadEndpoints: ['web'],
    componentName: 'orders',
  };

  it('starts from the default type, project visibility and a placeholder backend', () => {
    expect(template).toMatchObject({
      kind: 'Endpoint',
      spec: {
        owner: { projectName: 'shop', componentName: 'orders' },
        type: { kind: 'ClusterEndpointType', name: 'http-route' },
        visibility: ['project'],
        backendRefs: [
          { component: { name: 'orders', endpoint: '<workload-endpoint>' } },
        ],
        parameters: {},
      },
    });
  });

  it('reads the type and the workload endpoint it routes to', () => {
    expect(
      parseEndpointYaml(
        yaml.replace('<workload-endpoint>', 'web'),
        template,
        rules,
      ),
    ).toEqual({
      visibility: ['project'],
      parameters: {},
      typeKey: ROUTE,
      workloadEndpoint: 'web',
    });
  });

  it('refuses a type the component type does not allow', () => {
    expect(
      parseEndpointYaml(
        yaml
          .replace('<workload-endpoint>', 'web')
          .replace('name: http-route', 'name: other'),
        template,
        rules,
      ),
    ).toEqual({ error: expect.stringMatching(/spec.type must be one of/) });
  });

  it('refuses a workload endpoint the Workload lacks or another Endpoint uses', () => {
    expect(
      parseEndpointYaml(
        yaml.replace('<workload-endpoint>', 'api'),
        template,
        rules,
      ),
    ).toEqual({
      error: expect.stringMatching(
        /Workload endpoint api isn't in the Workload tab/,
      ),
    });
  });

  it("refuses a type that doesn't serve the workload endpoint's protocol", () => {
    const withWeb = (protocol: string) =>
      parseEndpointYaml(yaml.replace('<workload-endpoint>', 'web'), template, {
        ...rules,
        workloadEndpoints: { web: { protocol } },
      });

    expect(withWeb('HTTP')).toMatchObject({ typeKey: ROUTE });
    expect(withWeb('TCP')).toEqual({
      error: expect.stringMatching(
        /No Endpoint type the component type allows serves TCP/,
      ),
    });
  });

  it('keeps the owner fixed', () => {
    expect(
      parseEndpointYaml(
        yaml
          .replace('<workload-endpoint>', 'web')
          .replace('projectName: shop', 'projectName: other'),
        template,
        rules,
      ),
    ).toEqual({
      error: expect.stringMatching(/name and owner are set on save/),
    });
  });
});
