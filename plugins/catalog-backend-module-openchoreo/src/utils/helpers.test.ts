import {
  applyMetadataLabels,
  buildComponentDependsOnRefs,
  extractMetadataLabels,
  extractWorkloadResourceDependencies,
  filterDependenciesWithSchema,
  type EndpointSchemaLookup,
} from './helpers';
import type { WorkloadDependency } from './types';
import type { Entity } from '@backstage/catalog-model';
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

describe('extractMetadataLabels', () => {
  it('keeps every label with its full key (nothing excluded)', () => {
    const resource = {
      metadata: {
        labels: {
          'metadata.openchoreo.dev/cloud-provider': 'azure',
          'acme.com/team': 'payments',
          'tier': 'gold',
          'openchoreo.io/managed': 'true',
          'openchoreo.dev/project': 'checkout',
          'app.kubernetes.io/name': 'checkout',
        },
      },
    };
    expect(extractMetadataLabels(resource)).toEqual({
      'metadata.openchoreo.dev/cloud-provider': 'azure',
      'acme.com/team': 'payments',
      tier: 'gold',
      'openchoreo.io/managed': 'true',
      'openchoreo.dev/project': 'checkout',
      'app.kubernetes.io/name': 'checkout',
    });
  });

  it('skips empty values and returns {} when there are no labels', () => {
    expect(
      extractMetadataLabels({ metadata: { labels: { tier: '' } } }),
    ).toEqual({});
    expect(extractMetadataLabels({})).toEqual({});
    expect(extractMetadataLabels({ metadata: {} })).toEqual({});
  });
});

describe('applyMetadataLabels', () => {
  const baseEntity = (): Entity => ({
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { name: 'checkout', labels: { 'openchoreo.io/managed': 'true' } },
    spec: {},
  });

  it('merges all labels (full keys) while preserving existing labels', () => {
    const entity = applyMetadataLabels(baseEntity(), {
      metadata: {
        labels: {
          'metadata.openchoreo.dev/team': 'payments',
          'openchoreo.io/component': 'checkout',
        },
      },
    });
    expect(entity.metadata.labels).toEqual({
      'openchoreo.io/managed': 'true',
      'metadata.openchoreo.dev/team': 'payments',
      'openchoreo.io/component': 'checkout',
    });
  });

  it('returns the entity unchanged when there are no metadata labels', () => {
    const entity = baseEntity();
    const result = applyMetadataLabels(entity, { metadata: { labels: {} } });
    expect(result).toBe(entity);
    expect(result.metadata.labels).toEqual({ 'openchoreo.io/managed': 'true' });
  });
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
    expect(extractWorkloadResourceDependencies({} as NewWorkload)).toEqual([]);
  });
});

describe('buildComponentDependsOnRefs', () => {
  it('maps each resource dep to a resource:<ns>/<ref> entity ref', () => {
    expect(
      buildComponentDependsOnRefs(
        [{ ref: 'analytics-db' }, { ref: 'shared-cache' }],
        'finance',
      ),
    ).toEqual([
      'resource:finance/analytics-db',
      'resource:finance/shared-cache',
    ]);
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
