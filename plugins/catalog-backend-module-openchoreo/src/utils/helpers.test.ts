import {
  buildComponentDependsOnRefs,
  extractWorkloadResourceDependencies,
  filterDependenciesWithSchema,
  type EndpointSchemaLookup,
} from './helpers';
import type { WorkloadDependency } from './types';
import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';

type NewWorkload = OpenChoreoComponents['schemas']['Workload'];

const dep = (
  overrides: Partial<WorkloadDependency> & {
    component: string;
    name: string;
  },
): WorkloadDependency => ({
  visibility: 'public',
  ...overrides,
});

describe('filterDependenciesWithSchema', () => {
  it('keeps deps whose target endpoint exposes a schema and drops the rest', async () => {
    // Lookup: only the (project, component, endpoint) tuples in this
    // set return true. Anything else is treated as "no schema, drop".
    const schemafulEndpoints = new Set([
      'order:order-service:http',
      'inventory:inventory-svc:grpc',
    ]);
    const lookup: EndpointSchemaLookup = (project, component, endpoint) =>
      schemafulEndpoints.has(`${project}:${component}:${endpoint}`);

    const result = await filterDependenciesWithSchema(
      [
        // schemaful, intra-project (no `project` set → defaultProject used)
        dep({ component: 'order-service', name: 'http' }),
        // schemaless intra-project → drop
        dep({ component: 'order-service', name: 'metrics' }),
        // schemaful, cross-project
        dep({
          project: 'inventory',
          component: 'inventory-svc',
          name: 'grpc',
        }),
        // schemaless cross-project → drop
        dep({
          project: 'inventory',
          component: 'inventory-svc',
          name: 'admin',
        }),
      ],
      'order',
      lookup,
    );

    expect(
      result.map(d => `${d.project ?? '-'}:${d.component}:${d.name}`),
    ).toEqual(['-:order-service:http', 'inventory:inventory-svc:grpc']);
  });

  it('uses `defaultProject` when a dep omits its own `project`', async () => {
    const lookups: Array<[string, string, string]> = [];
    const lookup: EndpointSchemaLookup = (project, component, endpoint) => {
      lookups.push([project, component, endpoint]);
      return true;
    };

    await filterDependenciesWithSchema(
      [
        dep({ component: 'a', name: 'http' }),
        dep({ project: 'override', component: 'b', name: 'grpc' }),
      ],
      'default-project',
      lookup,
    );

    expect(lookups).toEqual([
      ['default-project', 'a', 'http'],
      ['override', 'b', 'grpc'],
    ]);
  });

  it('awaits async lookups and treats them as filter results', async () => {
    // Confirms callers can plumb an API-backed predicate without
    // having to materialise sync flags first.
    const asyncLookup: EndpointSchemaLookup = (_, component, endpoint) =>
      Promise.resolve(component === 'has-schema' && endpoint === 'http');

    const result = await filterDependenciesWithSchema(
      [
        dep({ component: 'has-schema', name: 'http' }),
        dep({ component: 'has-schema', name: 'metrics' }),
        dep({ component: 'no-schema', name: 'http' }),
      ],
      'p',
      asyncLookup,
    );

    expect(result.map(d => `${d.component}:${d.name}`)).toEqual([
      'has-schema:http',
    ]);
  });

  it('returns an empty array when given no dependencies', async () => {
    const lookup = jest.fn().mockReturnValue(true);
    const result = await filterDependenciesWithSchema([], 'p', lookup);
    expect(result).toEqual([]);
    expect(lookup).not.toHaveBeenCalled();
  });
});

describe('extractWorkloadResourceDependencies', () => {
  function workload(spec: unknown): NewWorkload {
    return { spec } as unknown as NewWorkload;
  }

  it('returns each resource dependency in spec order', () => {
    const result = extractWorkloadResourceDependencies(
      workload({
        dependencies: {
          resources: [
            { ref: 'analytics-db' },
            { ref: 'shared-cache' },
            { ref: 'queue' },
          ],
        },
      }),
    );
    expect(result.map(r => r.ref)).toEqual([
      'analytics-db',
      'shared-cache',
      'queue',
    ]);
  });

  it('returns an empty array when dependencies is absent', () => {
    expect(extractWorkloadResourceDependencies(workload({}))).toEqual([]);
  });

  it('returns an empty array when dependencies.resources is absent', () => {
    expect(
      extractWorkloadResourceDependencies(
        workload({ dependencies: { endpoints: [] } }),
      ),
    ).toEqual([]);
  });

  it('returns an empty array when spec is absent', () => {
    expect(
      extractWorkloadResourceDependencies({} as NewWorkload),
    ).toEqual([]);
  });
});

describe('buildComponentDependsOnRefs', () => {
  it('maps each resource dep to a resource:<ns>/<ref> entity ref', () => {
    expect(
      buildComponentDependsOnRefs(
        [{ ref: 'analytics-db' }, { ref: 'shared-cache' }],
        'finance',
      ),
    ).toEqual(['resource:finance/analytics-db', 'resource:finance/shared-cache']);
  });

  it('preserves declared order', () => {
    expect(
      buildComponentDependsOnRefs(
        [{ ref: 'c' }, { ref: 'a' }, { ref: 'b' }],
        'ns',
      ),
    ).toEqual(['resource:ns/c', 'resource:ns/a', 'resource:ns/b']);
  });

  it('returns an empty array when no deps are given', () => {
    expect(buildComponentDependsOnRefs([], 'finance')).toEqual([]);
  });
});
