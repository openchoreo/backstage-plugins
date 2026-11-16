import type { ComponentEndpointSummary } from '@openchoreo/backstage-plugin-common';
import {
  endpointChangeList,
  endpointFormSwitchSummary,
  exposedEndpointNames,
  initialEndpointMode,
  planEndpointChanges,
  type EndpointPlanInput,
} from './componentEndpointDrafts';

const allowedEndpoints = [
  {
    protocols: ['HTTP'],
    ref: { kind: 'ClusterEndpointType', name: 'http-route' },
    default: true,
  },
  {
    protocols: ['HTTP'],
    ref: { kind: 'ClusterEndpointType', name: 'managed-http' },
  },
];
const ROUTE = 'ClusterEndpointType/http-route';
const MANAGED = 'ClusterEndpointType/managed-http';

const original = (
  overrides: Partial<ComponentEndpointSummary> = {},
): ComponentEndpointSummary => ({
  name: 'orders-api',
  workloadEndpoint: 'api',
  typeKind: 'ClusterEndpointType',
  typeName: 'http-route',
  visibility: ['external'],
  parameters: {},
  autoDeploy: true,
  ...overrides,
});

const input = (overrides: Partial<EndpointPlanInput>): EndpointPlanInput => ({
  mode: 'endpoints',
  endpoints: {},
  allowedEndpoints,
  choices: {},
  originals: [],
  renames: {},
  ...overrides,
});

const ops = (plan: ReturnType<typeof planEndpointChanges>) =>
  plan.map(c =>
    c.op === 'create'
      ? `create ${c.workloadEndpoint}`
      : `${c.op} ${c.original.name}`,
  );

describe('planEndpointChanges', () => {
  it('needs no call for an unchanged Endpoint', () => {
    expect(
      planEndpointChanges(
        input({
          endpoints: { api: { protocol: 'HTTP', visibility: ['external'] } },
          choices: { api: { type: ROUTE, parameters: {} } },
          originals: [original()],
        }),
      ),
    ).toEqual([]);
  });

  it('exposes every row with visibility beyond project through the default type', () => {
    const plan = input({
      endpoints: {
        legacy: { type: 'HTTP', visibility: ['external'] },
        admin: { type: 'HTTP', visibility: ['project'] },
      },
      choices: { legacy: { type: 'none' } },
    });
    expect(planEndpointChanges(plan)).toEqual([
      {
        op: 'create',
        workloadEndpoint: 'legacy',
        typeKey: ROUTE,
        visibility: ['external'],
        parameters: {},
      },
    ]);
    expect(exposedEndpointNames(plan)).toEqual(['legacy']);
  });

  it('keeps a protocol no type serves project-only on the Endpoint side', () => {
    const plan = input({
      endpoints: { raw: { protocol: 'TCP', visibility: ['external'] } },
    });
    expect(planEndpointChanges(plan)).toEqual([]);
    expect(exposedEndpointNames(plan)).toEqual([]);
  });

  it('migrates mixed rows: keeps the Endpoint, creates one for the deprecated row', () => {
    expect(
      ops(
        planEndpointChanges(
          input({
            endpoints: {
              api: { protocol: 'HTTP', visibility: ['external'] },
              old: { protocol: 'HTTP', visibility: ['internal'] },
            },
            choices: { api: { type: ROUTE, parameters: {} } },
            originals: [original()],
          }),
        ),
      ),
    ).toEqual(['create old']);
  });

  it('deletes every Endpoint in the legacy form and keeps visibility on the workload', () => {
    const plan = input({
      mode: 'legacy',
      endpoints: {
        api: { protocol: 'HTTP', visibility: ['external'] },
        extra: { protocol: 'HTTP', visibility: ['internal'] },
      },
      choices: { api: { type: ROUTE, parameters: {} } },
      originals: [
        original(),
        original({ name: 'orders-api-2', visibility: ['namespace'] }),
      ],
    });
    expect(ops(planEndpointChanges(plan))).toEqual([
      'delete orders-api',
      'delete orders-api-2',
    ]);
    expect(exposedEndpointNames(plan)).toEqual([]);
  });

  it('creates an Endpoint when a type is chosen for a workload endpoint', () => {
    const plan = input({
      endpoints: {
        legacy: { type: 'HTTP', visibility: ['external', 'internal'] },
      },
      choices: {
        legacy: { type: MANAGED, parameters: { requireApiKey: true } },
      },
    });
    expect(planEndpointChanges(plan)).toEqual([
      {
        op: 'create',
        workloadEndpoint: 'legacy',
        typeKey: MANAGED,
        visibility: ['external', 'internal'],
        parameters: { requireApiKey: true },
      },
    ]);
    expect(exposedEndpointNames(plan)).toEqual(['legacy']);
  });

  it('replaces an Endpoint whose type changed, deleting first', () => {
    expect(
      ops(
        planEndpointChanges(
          input({
            endpoints: { api: { protocol: 'HTTP', visibility: ['external'] } },
            choices: { api: { type: MANAGED } },
            originals: [original()],
          }),
        ),
      ),
    ).toEqual(['delete orders-api', 'create api']);
  });

  it('deletes an Endpoint left with no visibility beyond project', () => {
    expect(
      ops(
        planEndpointChanges(
          input({
            endpoints: { api: { protocol: 'HTTP', visibility: ['project'] } },
            choices: { api: { type: ROUTE } },
            originals: [original()],
          }),
        ),
      ),
    ).toEqual(['delete orders-api']);
  });

  it('updates visibility, parameters and a renamed workload endpoint', () => {
    const [change] = planEndpointChanges(
      input({
        endpoints: {
          http: { protocol: 'HTTP', visibility: ['external', 'internal'] },
        },
        choices: { http: { type: ROUTE, parameters: { host: 'b' } } },
        originals: [original()],
        renames: { api: 'http' },
      }),
    );
    expect(change).toEqual(
      expect.objectContaining({
        op: 'update',
        workloadEndpoint: 'http',
        visibility: ['external', 'internal'],
        parameters: { host: 'b' },
      }),
    );
  });

  it('deletes the Endpoint of a removed workload endpoint', () => {
    expect(
      ops(planEndpointChanges(input({ originals: [original()] }))),
    ).toEqual(['delete orders-api']);
  });
});

describe('endpointChangeList', () => {
  it('describes each call for the save confirmation', () => {
    expect(
      endpointChangeList(
        planEndpointChanges(
          input({
            endpoints: {
              api: { protocol: 'HTTP', visibility: ['external', 'internal'] },
            },
            choices: { api: { type: ROUTE, parameters: {} } },
            originals: [original()],
          }),
        ),
      ),
    ).toEqual([
      {
        path: 'orders-api.visibility',
        type: 'modified',
        oldValue: 'external',
        newValue: 'external, internal',
      },
    ]);
  });
});

describe('initialEndpointMode', () => {
  const external = { api: { protocol: 'HTTP', visibility: ['external'] } };
  const projectOnly = { api: { protocol: 'HTTP', visibility: ['project'] } };

  it('opens the Endpoints form when the component has Endpoints', () => {
    expect(initialEndpointMode(external, [original()])).toBe('endpoints');
  });

  it('opens the Endpoints form without endpoints or with project-only ones', () => {
    expect(initialEndpointMode({}, [])).toBe('endpoints');
    expect(initialEndpointMode(projectOnly, [])).toBe('endpoints');
  });

  it('opens legacy when rows carry deprecated visibility and there are no Endpoints', () => {
    expect(initialEndpointMode(external, [])).toBe('legacy');
  });
});

describe('endpointFormSwitchSummary', () => {
  it('says nothing without a switch', () => {
    expect(endpointFormSwitchSummary('legacy', 'legacy', [])).toBeNull();
  });

  it('names the Endpoints a switch to legacy deletes', () => {
    const changes = planEndpointChanges(
      input({ mode: 'legacy', originals: [original()] }),
    );
    expect(endpointFormSwitchSummary('endpoints', 'legacy', changes)).toMatch(
      /Deletes Endpoints orders-api/,
    );
  });

  it('counts the endpoints a switch to Endpoints moves', () => {
    const changes = planEndpointChanges(
      input({
        endpoints: {
          a: { protocol: 'HTTP', visibility: ['external'] },
          b: { protocol: 'HTTP', visibility: ['internal'] },
        },
      }),
    );
    expect(endpointFormSwitchSummary('legacy', 'endpoints', changes)).toMatch(
      /Moves 2 endpoints to Endpoints \(a, b\)/,
    );
  });
});
