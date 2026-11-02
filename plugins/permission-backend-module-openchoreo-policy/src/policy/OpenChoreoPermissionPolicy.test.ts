import { mockServices } from '@backstage/backend-test-utils';
import {
  AuthorizeResult,
  createPermission,
} from '@backstage/plugin-permission-common';
import type { PolicyQueryUser } from '@backstage/plugin-permission-node';
import {
  dynamicCheckManagePermission,
  dynamicCheckReadPermission,
} from '@openchoreo/backstage-plugin-tech-insights-dynamic-checks-common';
import type { AuthzProfileService } from '../services';
import { OpenChoreoPermissionPolicy } from './OpenChoreoPermissionPolicy';

const user = {
  info: { userEntityRef: 'user:default/admin', ownershipEntityRefs: [] },
} as unknown as PolicyQueryUser;

function policyWithCapabilities(capabilities: Record<string, unknown>) {
  const authzService = {
    getCapabilitiesForUser: jest.fn().mockResolvedValue({ capabilities }),
  } as unknown as AuthzProfileService;
  return new OpenChoreoPermissionPolicy({
    authzService,
    logger: mockServices.logger.mock(),
  });
}

describe('OpenChoreoPermissionPolicy: tech-insights permissions', () => {
  it('allows check management when the user holds every action', async () => {
    const policy = policyWithCapabilities({
      '*': { allowed: [{ path: '*' }] },
    });
    const decision = await policy.handle(
      { permission: dynamicCheckManagePermission },
      user,
    );
    expect(decision.result).toBe(AuthorizeResult.ALLOW);
  });

  it('allows read-only access through scorecards:view alone', async () => {
    const policy = policyWithCapabilities({
      'scorecards:view': { allowed: [{ path: '*' }] },
    });
    expect(
      (await policy.handle({ permission: dynamicCheckReadPermission }, user))
        .result,
    ).toBe(AuthorizeResult.ALLOW);
    expect(
      (await policy.handle({ permission: dynamicCheckManagePermission }, user))
        .result,
    ).toBe(AuthorizeResult.DENY);
  });

  it('allows check management through scorecards:manage', async () => {
    const policy = policyWithCapabilities({
      'scorecards:manage': { allowed: [{ path: '*' }] },
    });
    const decision = await policy.handle(
      { permission: dynamicCheckManagePermission },
      user,
    );
    expect(decision.result).toBe(AuthorizeResult.ALLOW);
  });

  it('denies check management the user does not hold', async () => {
    const policy = policyWithCapabilities({
      'namespace:view': { allowed: [{ path: '*' }] },
      'clustercomponenttype:update': { allowed: [{ path: '*' }] },
    });
    const decision = await policy.handle(
      { permission: dynamicCheckReadPermission },
      user,
    );
    expect(decision.result).toBe(AuthorizeResult.DENY);
  });

  it('denies check management without a user', async () => {
    const policy = policyWithCapabilities({
      '*': { allowed: [{ path: '*' }] },
    });
    const decision = await policy.handle({
      permission: dynamicCheckManagePermission,
    });
    expect(decision.result).toBe(AuthorizeResult.DENY);
  });

  it('leaves upstream tech-insights permissions to the default allow', async () => {
    const policy = policyWithCapabilities({});
    const decision = await policy.handle(
      {
        permission: createPermission({
          name: 'tech-insights.check.run',
          attributes: { action: 'update' },
        }),
      },
      user,
    );
    expect(decision.result).toBe(AuthorizeResult.ALLOW);
  });
});
