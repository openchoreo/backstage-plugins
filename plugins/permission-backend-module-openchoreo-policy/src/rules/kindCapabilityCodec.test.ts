import { OPENCHOREO_MANAGED_ENTITY_KINDS } from '@openchoreo/backstage-plugin-common';
import {
  decodeKindCapabilities,
  encodeKindCapabilities,
  type KindCapabilities,
} from './kindCapabilityCodec';

describe('kindCapabilityCodec', () => {
  it('round-trips capabilities and pools shared paths', () => {
    const kindCapabilities: KindCapabilities = {
      component: {
        allowedPaths: ['ns/acme/project/foo', 'ns/acme/project/bar'],
        deniedPaths: ['ns/acme/project/foo/component/secret'],
      },
      system: {
        allowedPaths: ['ns/acme/project/bar', 'ns/acme/project/foo'],
        deniedPaths: [],
      },
      dataplane: { allowedPaths: ['*'], deniedPaths: [] },
      clusterdataplane: { allowedPaths: ['*'], deniedPaths: [] },
    };

    const encoded = encodeKindCapabilities(kindCapabilities);
    const decoded = decodeKindCapabilities(encoded);

    expect(Object.keys(decoded).sort()).toEqual(
      Object.keys(kindCapabilities).sort(),
    );
    for (const [kind, capability] of Object.entries(kindCapabilities)) {
      expect(decoded[kind].allowedPaths.sort()).toEqual(
        [...capability.allowedPaths].sort(),
      );
      expect(decoded[kind].deniedPaths.sort()).toEqual(
        [...capability.deniedPaths].sort(),
      );
    }

    // `system` differs from `component` only in ordering, so the two share a
    // group, and the two wildcard kinds share another.
    const wire = JSON.parse(encoded);
    expect(wire.g).toHaveLength(3);
    expect(wire.p).toEqual([
      'ns/acme/project/bar',
      'ns/acme/project/foo',
      'ns/acme/project/foo/component/secret',
      '*',
    ]);
  });

  it('drops the unused action field and duplicate paths', () => {
    const encoded = encodeKindCapabilities({
      component: {
        action: 'component:view',
        allowedPaths: ['ns/acme', 'ns/acme'],
        deniedPaths: [],
      },
    });

    expect(encoded).not.toContain('component:view');
    expect(decodeKindCapabilities(encoded)).toEqual({
      component: { allowedPaths: ['ns/acme'], deniedPaths: [] },
    });
  });

  it('decodes the legacy verbose form', () => {
    const legacy = JSON.stringify({
      component: {
        action: 'component:view',
        allowedPaths: ['ns/acme'],
        deniedPaths: [],
      },
    });

    expect(decodeKindCapabilities(legacy)).toEqual({
      component: {
        action: 'component:view',
        allowedPaths: ['ns/acme'],
        deniedPaths: [],
      },
    });
  });

  it('keeps the condition payload small for a user in many projects', () => {
    // Reproduces openchoreo/openchoreo#4915: a user holding a project-scoped
    // role in every project they belong to, plus namespace- and cluster-wide
    // reader roles. The encoded params are repeated once per authorized
    // resource in the batched apply-conditions request, which the catalog
    // parses with a non-configurable 100 KB body limit.
    const projectPaths = Array.from(
      { length: 7 },
      (_, i) => `ns/default/project/project-${i}`,
    );

    const verbose: KindCapabilities = {};
    const collapsed: KindCapabilities = {};
    for (const kind of OPENCHOREO_MANAGED_ENTITY_KINDS) {
      const kindLower = kind.toLowerCase();
      const clusterScoped = kindLower.startsWith('cluster');
      // Only the project-level kinds keep per-project paths once collapsed;
      // everything else is covered by the broader reader grants.
      const projectLevel = ['component', 'system', 'resource'].includes(
        kindLower,
      );

      verbose[kindLower] = {
        action: `${kindLower}:view`,
        allowedPaths: clusterScoped
          ? ['*']
          : [...projectPaths, 'ns/default', ...(projectLevel ? [] : ['*'])],
        deniedPaths: [],
      };
      collapsed[kindLower] = {
        allowedPaths: projectLevel ? projectPaths : ['*'],
        deniedPaths: [],
      };
    }

    const before =
      JSON.stringify(verbose).length +
      JSON.stringify(OPENCHOREO_MANAGED_ENTITY_KINDS).length;
    const after = encodeKindCapabilities(collapsed).length;

    // ~7 KB per resource previously overflowed the limit at 25 hits.
    expect(before).toBeGreaterThan(6000);
    expect(after).toBeLessThan(1000);
    expect(after * 25).toBeLessThan(25_000);
  });
});
