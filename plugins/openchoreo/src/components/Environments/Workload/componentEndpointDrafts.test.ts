import type { ComponentEndpointSummary } from '@openchoreo/backstage-plugin-common';
import {
  editedEndpointChanges,
  endpointChangeList,
  endpointMigration,
  exposedEndpointNames,
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

  it('migrates a workload that still carries visibility, in the Endpoints form', () => {
    const plan = input({
      endpoints: {
        api: { protocol: 'HTTP', visibility: ['external'] },
        internalOnly: { protocol: 'HTTP', visibility: ['project'] },
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

describe('endpointMigration', () => {
  const saved = {
    api: { protocol: 'HTTP', visibility: ['external'] },
    owned: { protocol: 'HTTP', visibility: ['project'] },
    internal: { protocol: 'HTTP', visibility: ['project'] },
  };
  const rows = {
    ...saved,
    owned: { protocol: 'HTTP', visibility: ['project', 'external'] },
  };

  it("doesn't count the workload's own visibility moving to Endpoints as an edit", () => {
    const originals = [
      original({ name: 'orders-owned', workloadEndpoint: 'owned' }),
    ];
    const changes = planEndpointChanges(input({ endpoints: rows, originals }));
    const migration = endpointMigration(saved, originals, changes);

    expect(migration.names).toEqual(['api']);
    expect(ops(changes)).toContain('create api');
    expect(ops(editedEndpointChanges(changes, migration))).not.toContain(
      'create api',
    );
  });

  it('counts the migration once the developer changes it', () => {
    const changes = planEndpointChanges(input({ endpoints: rows }));
    const migration = endpointMigration(saved, [], changes);
    const edited = planEndpointChanges(
      input({
        endpoints: rows,
        choices: { api: { type: MANAGED, parameters: {} } },
      }),
    );

    expect(ops(editedEndpointChanges(edited, migration))).toContain(
      'create api',
    );
  });

  it('counts every change without a recorded migration', () => {
    const changes = planEndpointChanges(input({ endpoints: rows }));
    expect(editedEndpointChanges(changes, null)).toBe(changes);
  });
});
