import { mockServices } from '@backstage/backend-test-utils';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { catalogEntityReadPermission } from '@backstage/plugin-catalog-common/alpha';
import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { PolicyQueryUser } from '@backstage/plugin-permission-node';
import { OpenChoreoPermissionPolicy } from './OpenChoreoPermissionPolicy';
import { matchesCatalogEntityCapability } from '../rules';
import { AuthzProfileService } from '../services';

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

describe('OpenChoreoPermissionPolicy - Catalog Permission Scoped Capabilities (Issue #763)', () => {
  const mockLogger = mockServices.logger.mock();

  it('preserves scoped capability paths (e.g. with constraints) in kindCapabilities for System/Project entities', async () => {
    const mockAuthzService = {
      getCapabilitiesForUser: jest.fn().mockResolvedValue({
        capabilities: {
          'project:view': {
            allowed: [
              {
                path: 'ns/acme/project/project-a',
                constraints: {
                  expressions: ['resource.environment == "prod"'],
                },
              },
            ],
            denied: [],
          },
        },
      }),
    } as unknown as AuthzProfileService;

    const policy = new OpenChoreoPermissionPolicy({
      authzService: mockAuthzService,
      logger: mockLogger,
    });

    const user: PolicyQueryUser = {
      info: {
        userEntityRef: 'user:default/scoped-user',
      },
    } as unknown as PolicyQueryUser;

    const decision = await policy.handle(
      { permission: catalogEntityReadPermission },
      user,
    );

    expect(decision.result).toBe(AuthorizeResult.CONDITIONAL);
    if (decision.result !== AuthorizeResult.CONDITIONAL) {
      throw new Error('Expected CONDITIONAL decision');
    }

    const ruleCondition = decision.conditions as any;
    expect(ruleCondition).toBeDefined();
    expect(ruleCondition.rule).toBe('MATCHES_CATALOG_ENTITY_CAPABILITY');

    const kindCapabilities = JSON.parse(
      ruleCondition.params.kindCapabilitiesJson,
    );

    // Assert that kindCapabilities.system.allowedPaths contains the scoped project path
    expect(kindCapabilities.system).toBeDefined();
    expect(kindCapabilities.system.allowedPaths).toEqual([
      'ns/acme/project/project-a',
    ]);

    // Test apply against a matching System entity (OpenChoreo Project)
    const matchingEntity = makeEntity('System', {
      [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
      [CHOREO_ANNOTATIONS.PROJECT_ID]: 'project-a',
    });

    const matchesMatching = matchesCatalogEntityCapability.apply(
      matchingEntity,
      ruleCondition.params,
    );
    expect(matchesMatching).toBe(true);

    // Test apply against a non-matching System entity (out-of-scope project)
    const nonMatchingEntity = makeEntity('System', {
      [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
      [CHOREO_ANNOTATIONS.PROJECT_ID]: 'project-b',
    });

    const matchesNonMatching = matchesCatalogEntityCapability.apply(
      nonMatchingEntity,
      ruleCondition.params,
    );
    expect(matchesNonMatching).toBe(false);
  });

  it('allows plain unconstrained scoped capability paths', async () => {
    const mockAuthzService = {
      getCapabilitiesForUser: jest.fn().mockResolvedValue({
        capabilities: {
          'project:view': {
            allowed: [
              {
                path: 'ns/acme/project/project-a',
              },
            ],
            denied: [],
          },
        },
      }),
    } as unknown as AuthzProfileService;

    const policy = new OpenChoreoPermissionPolicy({
      authzService: mockAuthzService,
      logger: mockLogger,
    });

    const user: PolicyQueryUser = {
      info: {
        userEntityRef: 'user:default/scoped-user',
      },
    } as unknown as PolicyQueryUser;

    const decision = await policy.handle(
      { permission: catalogEntityReadPermission },
      user,
    );

    expect(decision.result).toBe(AuthorizeResult.CONDITIONAL);
    if (decision.result !== AuthorizeResult.CONDITIONAL) {
      throw new Error('Expected CONDITIONAL decision');
    }

    const ruleCondition = decision.conditions as any;
    const kindCapabilities = JSON.parse(
      ruleCondition.params.kindCapabilitiesJson,
    );

    expect(kindCapabilities.system.allowedPaths).toEqual([
      'ns/acme/project/project-a',
    ]);

    const matchingEntity = makeEntity('System', {
      [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
      [CHOREO_ANNOTATIONS.PROJECT_ID]: 'project-a',
    });
    expect(
      matchesCatalogEntityCapability.apply(
        matchingEntity,
        ruleCondition.params,
      ),
    ).toBe(true);

    const nonMatchingEntity = makeEntity('System', {
      [CHOREO_ANNOTATIONS.NAMESPACE]: 'acme',
      [CHOREO_ANNOTATIONS.PROJECT_ID]: 'project-b',
    });
    expect(
      matchesCatalogEntityCapability.apply(
        nonMatchingEntity,
        ruleCondition.params,
      ),
    ).toBe(false);
  });
});
