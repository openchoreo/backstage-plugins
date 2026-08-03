import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import {
  transformProjectReleaseBinding,
  deriveProjectDeploymentStatus,
} from './project-release-binding';

type ProjectReleaseBinding =
  OpenChoreoComponents['schemas']['ProjectReleaseBinding'];

function makeBinding(overrides: Partial<ProjectReleaseBinding> = {}) {
  return {
    metadata: {
      name: 'shop-dev',
      namespace: 'acme',
      creationTimestamp: '2025-01-01T00:00:00Z',
    },
    spec: {
      owner: { projectName: 'shop' },
      environment: 'dev',
      projectRelease: 'shop-abc123',
      environmentConfigs: { replicas: 2 },
    },
    status: {
      conditions: [
        {
          type: 'Ready',
          status: 'True',
          reason: 'Ready',
          message: 'binding is ready',
          observedGeneration: 1,
        },
      ],
      namespace: 'dp-acme-shop-dev-abc',
    },
    ...overrides,
  } as ProjectReleaseBinding;
}

describe('transformProjectReleaseBinding', () => {
  it('maps the basic spec and metadata fields', () => {
    const result = transformProjectReleaseBinding(makeBinding());

    expect(result.name).toBe('shop-dev');
    expect(result.projectName).toBe('shop');
    expect(result.namespaceName).toBe('acme');
    expect(result.environment).toBe('dev');
    expect(result.releaseName).toBe('shop-abc123');
    expect(result.environmentConfigs).toEqual({ replicas: 2 });
    expect(result.namespace).toBe('dp-acme-shop-dev-abc');
    expect(result.createdAt).toBe('2025-01-01T00:00:00Z');
  });

  it('derives Ready status from conditions', () => {
    const result = transformProjectReleaseBinding(makeBinding());
    expect(result.status).toBe('Ready');
    expect(result.conditions).toHaveLength(1);
    expect(result.conditions?.[0].type).toBe('Ready');
  });

  it('omits environmentConfigs and namespace when absent', () => {
    const result = transformProjectReleaseBinding(
      makeBinding({
        spec: {
          owner: { projectName: 'shop' },
          environment: 'dev',
          projectRelease: 'shop-abc123',
        },
        status: { conditions: [] },
      } as Partial<ProjectReleaseBinding>),
    );

    expect(result.environmentConfigs).toBeUndefined();
    expect(result.namespace).toBeUndefined();
  });

  it('falls back to empty strings when owner/spec fields are missing', () => {
    const result = transformProjectReleaseBinding({
      metadata: { name: 'orphan', namespace: 'acme' },
    } as ProjectReleaseBinding);

    expect(result.name).toBe('orphan');
    expect(result.projectName).toBe('');
    expect(result.environment).toBe('');
    expect(result.releaseName).toBe('');
  });

  it('defaults required condition fields when a condition is partially populated', () => {
    const result = transformProjectReleaseBinding(
      makeBinding({
        status: {
          // A malformed condition missing the required type/status fields,
          // but carrying the optional ones.
          conditions: [
            { reason: 'Reconciling', message: 'still working' } as any,
          ],
        },
      } as Partial<ProjectReleaseBinding>),
    );

    expect(result.conditions).toHaveLength(1);
    const condition = result.conditions![0];
    expect(condition.type).toBe('');
    expect(condition.status).toBe('');
    expect(condition.reason).toBe('Reconciling');
    expect(condition.message).toBe('still working');
  });
});

describe('deriveProjectDeploymentStatus', () => {
  const withConditions = (
    conditions: Array<{ type: string; status: string }>,
  ) => makeBinding({ status: { conditions } as any });

  it('returns not-deployed when there is no binding', () => {
    expect(deriveProjectDeploymentStatus(undefined)).toBe('not-deployed');
  });

  it('returns ready when NamespaceReady is True', () => {
    expect(
      deriveProjectDeploymentStatus(
        withConditions([{ type: 'NamespaceReady', status: 'True' }]),
      ),
    ).toBe('ready');
  });

  it('keys off NamespaceReady, not the aggregate Ready — ready even when ResourcesReady is False', () => {
    expect(
      deriveProjectDeploymentStatus(
        withConditions([
          { type: 'NamespaceReady', status: 'True' },
          { type: 'ResourcesReady', status: 'False' },
          { type: 'Ready', status: 'False' },
        ]),
      ),
    ).toBe('ready');
  });

  it('returns pending when NamespaceReady is False', () => {
    expect(
      deriveProjectDeploymentStatus(
        withConditions([{ type: 'NamespaceReady', status: 'False' }]),
      ),
    ).toBe('pending');
  });

  it('returns pending when NamespaceReady is Unknown (unpinned ProjectReleaseNotSet)', () => {
    expect(
      deriveProjectDeploymentStatus(
        withConditions([
          { type: 'Synced', status: 'False' },
          { type: 'NamespaceReady', status: 'Unknown' },
        ]),
      ),
    ).toBe('pending');
  });

  it('returns pending when NamespaceReady condition is absent', () => {
    expect(
      deriveProjectDeploymentStatus(
        withConditions([{ type: 'Ready', status: 'True' }]),
      ),
    ).toBe('pending');
  });

  it('returns pending when the binding has no status/conditions yet', () => {
    expect(
      deriveProjectDeploymentStatus(makeBinding({ status: undefined })),
    ).toBe('pending');
  });
});
