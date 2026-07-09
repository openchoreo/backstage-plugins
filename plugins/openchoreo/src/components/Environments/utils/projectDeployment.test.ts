import type { Environment } from '../hooks/useEnvironmentData';
import {
  isProjectBlocking,
  isProjectPending,
  attributeToProjectNotDeployed,
  makeIsTargetProjectBlocked,
} from './projectDeployment';

const makeEnv = (over: Partial<Environment> = {}): Environment => ({
  name: 'Development',
  resourceName: 'development',
  endpoints: [],
  deployment: {},
  ...over,
});

describe('isProjectBlocking / isProjectPending', () => {
  it('blocks only on not-deployed', () => {
    expect(
      isProjectBlocking(makeEnv({ projectDeploymentStatus: 'not-deployed' })),
    ).toBe(true);
    expect(
      isProjectBlocking(makeEnv({ projectDeploymentStatus: 'pending' })),
    ).toBe(false);
    expect(
      isProjectBlocking(makeEnv({ projectDeploymentStatus: 'ready' })),
    ).toBe(false);
    // absent → fail-open (not blocking)
    expect(isProjectBlocking(makeEnv())).toBe(false);
  });

  it('flags pending only on pending', () => {
    expect(
      isProjectPending(makeEnv({ projectDeploymentStatus: 'pending' })),
    ).toBe(true);
    expect(
      isProjectPending(makeEnv({ projectDeploymentStatus: 'not-deployed' })),
    ).toBe(false);
    expect(isProjectPending(makeEnv())).toBe(false);
  });
});

describe('attributeToProjectNotDeployed', () => {
  it('true on the first-class ProjectNotDeployed reason', () => {
    expect(
      attributeToProjectNotDeployed(
        makeEnv({
          projectDeploymentStatus: 'not-deployed',
          deployment: { status: 'Failed', statusReason: 'ProjectNotDeployed' },
        }),
      ),
    ).toBe(true);
  });

  it('true on the namespace-not-found heuristic when the project is not deployed', () => {
    expect(
      attributeToProjectNotDeployed(
        makeEnv({
          projectDeploymentStatus: 'not-deployed',
          deployment: {
            status: 'Failed',
            statusReason: 'ResourceApplyFailed',
            statusMessage:
              'Failed to apply resources to target plane: failed to apply resource deployment-x: namespaces "dp-default-test-project--development-0569e83c" not found',
          },
        }),
      ),
    ).toBe(true);
  });

  it('false when the same apply error occurs but the project IS deployed (genuine failure)', () => {
    expect(
      attributeToProjectNotDeployed(
        makeEnv({
          projectDeploymentStatus: 'ready',
          deployment: {
            status: 'Failed',
            statusReason: 'ResourceApplyFailed',
            statusMessage: 'namespaces "dp-x" not found',
          },
        }),
      ),
    ).toBe(false);
  });

  it('false for unrelated failures and non-failed states', () => {
    expect(
      attributeToProjectNotDeployed(
        makeEnv({
          projectDeploymentStatus: 'not-deployed',
          deployment: {
            status: 'Failed',
            statusReason: 'RenderingFailed',
            statusMessage: 'CEL error',
          },
        }),
      ),
    ).toBe(false);
    expect(
      attributeToProjectNotDeployed(
        makeEnv({
          projectDeploymentStatus: 'not-deployed',
          deployment: { status: 'Ready' },
        }),
      ),
    ).toBe(false);
  });
});

describe('makeIsTargetProjectBlocked', () => {
  const envs = [
    makeEnv({
      name: 'Development',
      resourceName: 'development',
      projectDeploymentStatus: 'ready',
    }),
    makeEnv({
      name: 'Staging',
      resourceName: 'staging',
      projectDeploymentStatus: 'not-deployed',
    }),
  ];
  const isBlocked = makeIsTargetProjectBlocked(envs);

  it('resolves a target by display name', () => {
    expect(isBlocked({ name: 'Staging' })).toBe(true);
    expect(isBlocked({ name: 'Development' })).toBe(false);
  });

  it('resolves a target by resource name', () => {
    expect(isBlocked({ name: 'x', resourceName: 'staging' })).toBe(true);
  });

  it('treats an unknown target as not blocked (fail-open)', () => {
    expect(isBlocked({ name: 'production' })).toBe(false);
  });
});
