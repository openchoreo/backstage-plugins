import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { matchesCapability } from './matchesCapability';

/**
 * Helper to build a minimal Entity with OpenChoreo annotations.
 */
function makeEntity(
  kind: string,
  annotations: Record<string, string | undefined> = {},
): Entity {
  // Strip undefined values to mimic how annotations are stored.
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

const apply = (
  entity: Entity,
  params: {
    action?: string;
    allowedPaths: string[];
    deniedPaths: string[];
  },
) =>
  matchesCapability.apply(entity, {
    action: params.action ?? 'component:view',
    allowedPaths: params.allowedPaths,
    deniedPaths: params.deniedPaths,
  });

describe('matchesCapability.apply', () => {
  describe('entity without namespace annotation', () => {
    it('denies when no namespace annotation present', () => {
      const entity = makeEntity('Component', {});
      expect(apply(entity, { allowedPaths: ['*'], deniedPaths: [] })).toBe(
        false,
      );
    });

    it('denies even with wildcard when annotation missing', () => {
      const entity = makeEntity('Component', {
        [CHOREO_ANNOTATIONS.PROJECT]: 'my-project',
      });
      expect(apply(entity, { allowedPaths: ['*'], deniedPaths: [] })).toBe(
        false,
      );
    });
  });

  describe('wildcard path matching', () => {
    it('allows when allowedPaths contains the global wildcard "*"', () => {
      const entity = makeEntity('Component', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
      });
      expect(apply(entity, { allowedPaths: ['*'], deniedPaths: [] })).toBe(
        true,
      );
    });
  });

  describe('namespace-level path matching', () => {
    it('allows when path matches the entity namespace', () => {
      const entity = makeEntity('Component', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
        [CHOREO_ANNOTATIONS.PROJECT]: 'foo',
      });
      expect(
        apply(entity, { allowedPaths: ['ns/acme'], deniedPaths: [] }),
      ).toBe(true);
    });

    it('denies when namespace does not match', () => {
      const entity = makeEntity('Component', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
      });
      expect(
        apply(entity, { allowedPaths: ['ns/other'], deniedPaths: [] }),
      ).toBe(false);
    });

    it('allows when namespace wildcard ns/* matches any namespace', () => {
      const entity = makeEntity('Component', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
      });
      expect(apply(entity, { allowedPaths: ['ns/*'], deniedPaths: [] })).toBe(
        true,
      );
    });
  });

  describe('project-level path matching', () => {
    it('allows a component when project path matches', () => {
      const entity = makeEntity('Component', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
        [CHOREO_ANNOTATIONS.PROJECT]: 'foo',
        [CHOREO_ANNOTATIONS.COMPONENT]: 'api',
      });
      expect(
        apply(entity, {
          allowedPaths: ['ns/acme/project/foo'],
          deniedPaths: [],
        }),
      ).toBe(true);
    });

    it('denies when project path does not match', () => {
      const entity = makeEntity('Component', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
        [CHOREO_ANNOTATIONS.PROJECT]: 'foo',
      });
      expect(
        apply(entity, {
          allowedPaths: ['ns/acme/project/bar'],
          deniedPaths: [],
        }),
      ).toBe(false);
    });

    it('allows with project wildcard ns/acme/project/*', () => {
      const entity = makeEntity('Component', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
        [CHOREO_ANNOTATIONS.PROJECT]: 'foo',
      });
      expect(
        apply(entity, {
          allowedPaths: ['ns/acme/project/*'],
          deniedPaths: [],
        }),
      ).toBe(true);
    });
  });

  describe('component-level path matching', () => {
    it('allows when component matches exactly', () => {
      const entity = makeEntity('Component', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
        [CHOREO_ANNOTATIONS.PROJECT]: 'foo',
        [CHOREO_ANNOTATIONS.COMPONENT]: 'api',
      });
      expect(
        apply(entity, {
          allowedPaths: ['ns/acme/project/foo/component/api'],
          deniedPaths: [],
        }),
      ).toBe(true);
    });

    it('denies when component name does not match', () => {
      const entity = makeEntity('Component', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
        [CHOREO_ANNOTATIONS.PROJECT]: 'foo',
        [CHOREO_ANNOTATIONS.COMPONENT]: 'api',
      });
      expect(
        apply(entity, {
          allowedPaths: ['ns/acme/project/foo/component/other'],
          deniedPaths: [],
        }),
      ).toBe(false);
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
          allowedPaths: ['*'],
          deniedPaths: ['ns/acme'],
        }),
      ).toBe(false);
    });

    it('specific deny wins over broader allow', () => {
      const entity = makeEntity('Component', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
        [CHOREO_ANNOTATIONS.PROJECT]: 'foo',
        [CHOREO_ANNOTATIONS.COMPONENT]: 'api',
      });
      expect(
        apply(entity, {
          allowedPaths: ['ns/acme/project/foo'],
          deniedPaths: ['ns/acme/project/foo/component/api'],
        }),
      ).toBe(false);
    });

    it('deny on unrelated scope does not affect allow', () => {
      const entity = makeEntity('Component', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
        [CHOREO_ANNOTATIONS.PROJECT]: 'foo',
      });
      expect(
        apply(entity, {
          allowedPaths: ['ns/acme'],
          deniedPaths: ['ns/other'],
        }),
      ).toBe(true);
    });
  });

  describe('system entities', () => {
    it('uses PROJECT_ID annotation (not PROJECT) for project scope', () => {
      const entity = makeEntity('System', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
        [CHOREO_ANNOTATIONS.PROJECT_ID]: 'proj-uuid-123',
        [CHOREO_ANNOTATIONS.PROJECT]: 'wrong-name',
      });
      expect(
        apply(entity, {
          allowedPaths: ['ns/acme/project/proj-uuid-123'],
          deniedPaths: [],
        }),
      ).toBe(true);
    });

    it('denies System when PROJECT is set but PROJECT_ID is not', () => {
      const entity = makeEntity('System', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
        [CHOREO_ANNOTATIONS.PROJECT]: 'wrong-name',
      });
      expect(
        apply(entity, {
          allowedPaths: ['ns/acme/project/wrong-name'],
          deniedPaths: [],
        }),
      ).toBe(false);
    });
  });

  describe('namespace-scoped kinds', () => {
    const namespaceScopedKinds = [
      'ComponentType',
      'TraitType',
      'Workflow',
      'Environment',
      'DataPlane',
      'WorkflowPlane',
      'ObservabilityPlane',
      'DeploymentPipeline',
    ];

    it.each(namespaceScopedKinds)(
      'rejects project-scoped paths for %s',
      kind => {
        const entity = makeEntity(kind, {
          [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
        });
        expect(
          apply(entity, {
            allowedPaths: ['ns/acme/project/foo'],
            deniedPaths: [],
          }),
        ).toBe(false);
      },
    );

    it('accepts namespace-level paths for namespace-scoped kind', () => {
      const entity = makeEntity('Environment', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
      });
      expect(
        apply(entity, {
          allowedPaths: ['ns/acme'],
          deniedPaths: [],
        }),
      ).toBe(true);
    });

    it('rejects component-scoped paths for namespace-scoped kind', () => {
      const entity = makeEntity('Workflow', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
      });
      expect(
        apply(entity, {
          allowedPaths: ['ns/acme/project/foo/component/bar'],
          deniedPaths: [],
        }),
      ).toBe(false);
    });
  });

  describe('empty paths', () => {
    it('denies when both allowed and denied paths are empty', () => {
      const entity = makeEntity('Component', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
      });
      expect(apply(entity, { allowedPaths: [], deniedPaths: [] })).toBe(false);
    });

    it('denies when allowedPaths is empty even if denies are also empty', () => {
      const entity = makeEntity('Component', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
        [CHOREO_ANNOTATIONS.PROJECT]: 'foo',
      });
      expect(
        apply(entity, { allowedPaths: [], deniedPaths: ['ns/other'] }),
      ).toBe(false);
    });
  });

  describe('invalid paths', () => {
    it('ignores malformed allowedPaths', () => {
      const entity = makeEntity('Component', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
      });
      expect(
        apply(entity, {
          allowedPaths: ['garbage', 'ns/acme/wrong/foo'],
          deniedPaths: [],
        }),
      ).toBe(false);
    });

    it('allows when at least one valid path matches among invalid ones', () => {
      const entity = makeEntity('Component', {
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
      });
      expect(
        apply(entity, {
          allowedPaths: ['garbage', 'ns/acme'],
          deniedPaths: [],
        }),
      ).toBe(true);
    });
  });
});

describe('matchesCapability.toQuery', () => {
  it('returns an empty object (no DB filtering)', () => {
    const query = matchesCapability.toQuery({
      action: 'component:view',
      allowedPaths: ['*'],
      deniedPaths: [],
    });
    expect(query).toEqual({});
  });
});
