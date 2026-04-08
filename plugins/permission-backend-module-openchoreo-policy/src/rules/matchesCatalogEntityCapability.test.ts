import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import {
  matchesCatalogEntityCapability,
  KindCapabilities,
} from './matchesCatalogEntityCapability';

/**
 * Build a minimal Entity with the given kind and annotations.
 */
function makeEntity(
  kind: string,
  annotations: Record<string, string | undefined> = {},
): Entity {
  const cleanAnnotations: Record<string, string> = {};
  for (const [k, v] of Object.entries(annotations)) {
    if (v !== undefined) {
      cleanAnnotations[k] = v;
    }
  }
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind,
    metadata: {
      name: 'test-entity',
      annotations: cleanAnnotations,
    },
  };
}

/**
 * Convenience wrapper to call apply with serialized capabilities.
 */
function apply(
  entity: Entity,
  kindCapabilities: KindCapabilities,
  kinds: string[] = Object.keys(kindCapabilities),
): boolean {
  return matchesCatalogEntityCapability.apply(entity, {
    kindCapabilitiesJson: JSON.stringify(kindCapabilities),
    kinds,
  });
}

describe('matchesCatalogEntityCapability.apply', () => {
  describe('default-permissive behavior for non-managed kinds', () => {
    it('allows a User entity (kind not in managed kinds list)', () => {
      const entity = makeEntity('User', {});
      expect(
        apply(entity, {
          component: {
            action: 'component:view',
            allowedPaths: [],
            deniedPaths: [],
          },
        }),
      ).toBe(true);
    });

    it('allows a Group entity regardless of capabilities', () => {
      const entity = makeEntity('Group', {});
      expect(
        apply(
          entity,
          { component: { action: 'c:v', allowedPaths: [], deniedPaths: [] } },
          ['component'],
        ),
      ).toBe(true);
    });
  });

  describe('entities without namespace annotation (non-OpenChoreo)', () => {
    it('allows a Component entity missing namespace annotation', () => {
      const entity = makeEntity('Component', {});
      expect(
        apply(entity, {
          component: {
            action: 'component:view',
            allowedPaths: [],
            deniedPaths: [],
          },
        }),
      ).toBe(true);
    });

    it('allows a System entity missing namespace annotation', () => {
      const entity = makeEntity('System', {});
      expect(
        apply(entity, {
          system: {
            action: 'project:view',
            allowedPaths: [],
            deniedPaths: [],
          },
        }),
      ).toBe(true);
    });
  });

  describe('wildcard path matching', () => {
    it('allows OpenChoreo Component when allowedPaths contains "*"', () => {
      const entity = makeEntity('Component', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
      });
      expect(
        apply(entity, {
          component: {
            action: 'component:view',
            allowedPaths: ['*'],
            deniedPaths: [],
          },
        }),
      ).toBe(true);
    });
  });

  describe('namespace matching', () => {
    it('allows a Component when namespace matches', () => {
      const entity = makeEntity('Component', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
      });
      expect(
        apply(entity, {
          component: {
            action: 'component:view',
            allowedPaths: ['ns/acme'],
            deniedPaths: [],
          },
        }),
      ).toBe(true);
    });

    it('denies a Component when namespace does not match', () => {
      const entity = makeEntity('Component', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
      });
      expect(
        apply(entity, {
          component: {
            action: 'component:view',
            allowedPaths: ['ns/other'],
            deniedPaths: [],
          },
        }),
      ).toBe(false);
    });

    it('denies OpenChoreo Component when no capability defined for kind', () => {
      const entity = makeEntity('Component', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
      });
      // kinds includes 'component' but no capability entry provided for it
      expect(apply(entity, {}, ['component'])).toBe(false);
    });
  });

  describe('project matching', () => {
    it('allows Component when project path matches via PROJECT annotation', () => {
      const entity = makeEntity('Component', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
        [CHOREO_ANNOTATIONS.PROJECT]: 'foo',
      });
      expect(
        apply(entity, {
          component: {
            action: 'component:view',
            allowedPaths: ['ns/acme/project/foo'],
            deniedPaths: [],
          },
        }),
      ).toBe(true);
    });

    it('denies Component on project mismatch', () => {
      const entity = makeEntity('Component', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
        [CHOREO_ANNOTATIONS.PROJECT]: 'foo',
      });
      expect(
        apply(entity, {
          component: {
            action: 'component:view',
            allowedPaths: ['ns/acme/project/bar'],
            deniedPaths: [],
          },
        }),
      ).toBe(false);
    });

    it('System entity uses PROJECT_ID annotation for project scope', () => {
      const entity = makeEntity('System', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
        [CHOREO_ANNOTATIONS.PROJECT_ID]: 'proj-uuid-abc',
      });
      expect(
        apply(entity, {
          system: {
            action: 'project:view',
            allowedPaths: ['ns/acme/project/proj-uuid-abc'],
            deniedPaths: [],
          },
        }),
      ).toBe(true);
    });
  });

  describe('deny precedence', () => {
    it('deniedPaths take precedence over allowedPaths', () => {
      const entity = makeEntity('Component', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
        [CHOREO_ANNOTATIONS.PROJECT]: 'foo',
      });
      expect(
        apply(entity, {
          component: {
            action: 'component:view',
            allowedPaths: ['*'],
            deniedPaths: ['ns/acme'],
          },
        }),
      ).toBe(false);
    });
  });

  describe('namespace-scoped entity levels', () => {
    it('rejects project-scoped paths for Environment kind', () => {
      const entity = makeEntity('Environment', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
      });
      expect(
        apply(entity, {
          environment: {
            action: 'environment:view',
            allowedPaths: ['ns/acme/project/foo'],
            deniedPaths: [],
          },
        }),
      ).toBe(false);
    });

    it('allows namespace-level path for Workflow kind', () => {
      const entity = makeEntity('Workflow', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
      });
      expect(
        apply(entity, {
          workflow: {
            action: 'workflow:view',
            allowedPaths: ['ns/acme'],
            deniedPaths: [],
          },
        }),
      ).toBe(true);
    });
  });

  describe('System entities reject component-level paths', () => {
    it('rejects paths with a component segment for a System entity', () => {
      const entity = makeEntity('System', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
        [CHOREO_ANNOTATIONS.PROJECT_ID]: 'foo',
      });
      expect(
        apply(entity, {
          system: {
            action: 'project:view',
            allowedPaths: ['ns/acme/project/foo/component/api'],
            deniedPaths: [],
          },
        }),
      ).toBe(false);
    });
  });

  describe('cluster-scoped entities', () => {
    it('allows ClusterDataplane only when global wildcard "*" is allowed', () => {
      const entity = makeEntity('ClusterDataplane', {});
      expect(
        apply(
          entity,
          {
            clusterdataplane: {
              action: 'clusterdataplane:view',
              allowedPaths: ['*'],
              deniedPaths: [],
            },
          },
          ['clusterdataplane'],
        ),
      ).toBe(true);
    });

    it('denies cluster-scoped entity for namespace-level paths', () => {
      const entity = makeEntity('ClusterDataplane', {});
      expect(
        apply(
          entity,
          {
            clusterdataplane: {
              action: 'x',
              allowedPaths: ['ns/acme'],
              deniedPaths: [],
            },
          },
          ['clusterdataplane'],
        ),
      ).toBe(false);
    });

    it('denies cluster-scoped entity when deniedPaths has "*"', () => {
      const entity = makeEntity('ClusterWorkflow', {});
      expect(
        apply(
          entity,
          {
            clusterworkflow: {
              action: 'x',
              allowedPaths: ['*'],
              deniedPaths: ['*'],
            },
          },
          ['clusterworkflow'],
        ),
      ).toBe(false);
    });

    it('denies cluster-scoped entity when no capability defined', () => {
      const entity = makeEntity('ClusterTraittype', {});
      expect(apply(entity, {}, ['clustertraittype'])).toBe(false);
    });
  });

  describe('invalid JSON handling', () => {
    it('throws when kindCapabilitiesJson is invalid', () => {
      const entity = makeEntity('Component', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
      });
      expect(() =>
        matchesCatalogEntityCapability.apply(entity, {
          kindCapabilitiesJson: 'not-json',
          kinds: ['component'],
        }),
      ).toThrow();
    });
  });
});

describe('matchesCatalogEntityCapability.toQuery', () => {
  function toQuery(kindCapabilities: KindCapabilities, kinds?: string[]) {
    return matchesCatalogEntityCapability.toQuery({
      kindCapabilitiesJson: JSON.stringify(kindCapabilities),
      kinds: kinds ?? Object.keys(kindCapabilities),
    });
  }

  it('returns an anyOf filter including non-managed kinds when there are managed kinds', () => {
    const result = toQuery({
      component: {
        action: 'component:view',
        allowedPaths: ['*'],
        deniedPaths: [],
      },
    }) as any;

    expect(result).toHaveProperty('anyOf');
    expect(Array.isArray(result.anyOf)).toBe(true);
    // The first element should exclude the managed kind (non-managed filter)
    expect(result.anyOf[0]).toEqual({
      not: { key: 'kind', values: ['component'] },
    });
  });

  it('builds a non-openchoreo-only filter for a kind with no capability', () => {
    const result = toQuery({}, ['component']) as any;
    expect(result).toHaveProperty('anyOf');
    // Second element should restrict kind to entities without the namespace annotation
    const kindFilter = result.anyOf[1];
    expect(kindFilter).toHaveProperty('allOf');
    const [kindCondition, notAnnotation] = kindFilter.allOf;
    expect(kindCondition).toEqual({ key: 'kind', values: ['component'] });
    expect(notAnnotation).toEqual({
      not: {
        key: `metadata.annotations.${CHOREO_ANNOTATIONS.NAMESPACE}`,
      },
    });
  });

  it('allows entire kind when user has wildcard access', () => {
    const result = toQuery({
      component: {
        action: 'component:view',
        allowedPaths: ['*'],
        deniedPaths: [],
      },
    }) as any;
    // anyOf[1] = wildcard kind access filter
    expect(result.anyOf[1]).toEqual({ key: 'kind', values: ['component'] });
  });

  it('builds path-based filter using PROJECT annotation for components', () => {
    const result = toQuery({
      component: {
        action: 'component:view',
        allowedPaths: ['ns/acme/project/foo'],
        deniedPaths: [],
      },
    }) as any;

    // Expect at least one filter with the project annotation
    const serialized = JSON.stringify(result);
    expect(serialized).toContain(CHOREO_ANNOTATIONS.NAMESPACE);
    expect(serialized).toContain(CHOREO_ANNOTATIONS.PROJECT);
    expect(serialized).toContain('acme');
    expect(serialized).toContain('foo');
  });

  it('builds path-based filter using PROJECT_ID annotation for system kind', () => {
    const result = toQuery({
      system: {
        action: 'project:view',
        allowedPaths: ['ns/acme/project/proj-uuid'],
        deniedPaths: [],
      },
    }) as any;

    const serialized = JSON.stringify(result);
    expect(serialized).toContain(CHOREO_ANNOTATIONS.PROJECT_ID);
    expect(serialized).toContain('proj-uuid');
    // Should NOT use the PROJECT annotation for System entities
    expect(serialized).not.toContain(
      `metadata.annotations.${CHOREO_ANNOTATIONS.PROJECT}"`,
    );
  });

  it('includes cluster-scoped kind filter only when wildcard access granted', () => {
    const withWildcard = toQuery({
      clusterdataplane: {
        action: 'x',
        allowedPaths: ['*'],
        deniedPaths: [],
      },
    }) as any;
    expect(JSON.stringify(withWildcard)).toContain('clusterdataplane');

    const withoutWildcard = toQuery({
      clusterdataplane: {
        action: 'x',
        allowedPaths: ['ns/acme'],
        deniedPaths: [],
      },
    }) as any;
    // Without a wildcard, cluster-scoped kinds are excluded entirely.
    // Since no kind filters are generated, toQuery returns just the
    // otherKindsFilter (not wrapped in anyOf).
    expect(withoutWildcard).toEqual({
      not: { key: 'kind', values: ['clusterdataplane'] },
    });
  });

  it('returns the not-managed filter when no kind filters are generated', () => {
    // Pass a single cluster-scoped kind with no capability at all
    const result = toQuery({}, ['clusterdataplane']) as any;
    expect(result).toEqual({
      not: { key: 'kind', values: ['clusterdataplane'] },
    });
  });
});
