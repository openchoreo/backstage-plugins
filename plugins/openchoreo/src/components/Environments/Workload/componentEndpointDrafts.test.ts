import type { ComponentEndpointSummary } from '@openchoreo/backstage-plugin-common';
import {
  endpointCards,
  endpointChangeList,
  exposedEndpointNames,
  newEndpointName,
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

  it('keeps the Endpoint and leaves a deprecated row as it is until one is added for it', () => {
    const rows = {
      api: { protocol: 'HTTP', visibility: ['external'] },
      old: { protocol: 'HTTP', visibility: ['internal'] },
    };
    const choices = { api: { type: ROUTE, parameters: {} } };
    expect(
      planEndpointChanges(
        input({ endpoints: rows, choices, originals: [original()] }),
      ),
    ).toEqual([]);
    expect(
      ops(
        planEndpointChanges(
          input({
            endpoints: rows,
            choices: { ...choices, old: { type: ROUTE } },
            originals: [original()],
          }),
        ),
      ),
    ).toEqual(['create old']);
  });

  it('plans no Endpoint calls in the legacy form and keeps visibility on the workload', () => {
    const plan = input({
      mode: 'legacy',
      endpoints: {
        api: { protocol: 'HTTP', visibility: ['external'] },
        extra: { protocol: 'HTTP', visibility: ['internal'] },
      },
      choices: { api: { type: ROUTE, parameters: {} } },
      originals: [original()],
    });
    expect(planEndpointChanges(plan)).toEqual([]);
    expect(exposedEndpointNames(plan)).toEqual([]);
  });

  it('plans no Endpoint calls without a form', () => {
    const plan = input({
      mode: 'none',
      endpoints: { api: { protocol: 'HTTP', visibility: ['external'] } },
      choices: { api: { type: ROUTE } },
      originals: [original()],
    });
    expect(planEndpointChanges(plan)).toEqual([]);
    expect(exposedEndpointNames(plan)).toEqual([]);
  });

  it('keeps visibility on the workload for a row without a card', () => {
    const plan = input({
      endpoints: { api: { protocol: 'HTTP', visibility: ['external'] } },
    });
    expect(planEndpointChanges(plan)).toEqual([]);
    expect(exposedEndpointNames(plan)).toEqual([]);
  });

  it('creates an Endpoint for a row one was added for, moving its visibility', () => {
    const plan = input({
      endpoints: {
        api: { protocol: 'HTTP', visibility: ['external'] },
        internalOnly: { protocol: 'HTTP', visibility: ['project'] },
      },
      choices: {
        api: { type: ROUTE },
        internalOnly: { type: ROUTE },
      },
    });
    expect(ops(planEndpointChanges(plan))).toEqual(['create api']);
    expect(exposedEndpointNames(plan)).toEqual(['api']);
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

describe('newEndpointName', () => {
  it("names a new endpoint after HTTP's default Endpoint type", () => {
    expect(newEndpointName({}, allowedEndpoints)).toBe('http-route-1');
    expect(
      newEndpointName(
        { 'http-route-1': {}, 'endpoint-1': {} },
        allowedEndpoints,
      ),
    ).toBe('http-route-2');
  });

  it('falls back to endpoint-N outside the Endpoints form', () => {
    expect(newEndpointName({ 'endpoint-1': {} })).toBe('endpoint-2');
    expect(newEndpointName({}, [])).toBe('endpoint-1');
  });
});

describe('endpointCards', () => {
  const old = { protocol: 'HTTP', visibility: ['external'] };
  const rows = {
    old,
    added: { protocol: 'HTTP', visibility: ['project'] },
  };

  it('leaves out unchanged workload endpoints from before Endpoints', () => {
    expect(Object.keys(endpointCards(rows, 'endpoints', { old }))).toEqual([
      'added',
    ]);
  });

  it('shows a pre-Endpoint row again once a card replaces it', () => {
    const replaced = {
      ...rows,
      old: { protocol: 'HTTP', visibility: ['project'] },
    };
    expect(Object.keys(endpointCards(replaced, 'endpoints', { old }))).toEqual([
      'old',
      'added',
    ]);
  });

  it('lists nothing without a form and everything in the legacy form', () => {
    expect(endpointCards(rows, 'none', { old })).toEqual({});
    expect(endpointCards(rows, 'legacy', { old })).toBe(rows);
  });
});
