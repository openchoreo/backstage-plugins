import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import {
  deriveBindingStatus,
  deriveBindingStatusDetailed,
} from './release-binding';

type ReleaseBinding = OpenChoreoComponents['schemas']['ReleaseBinding'];

function makeBinding(
  conditions: Array<{
    type: string;
    status: string;
    reason?: string;
    message?: string;
    observedGeneration?: number;
  }>,
  generation?: number,
): ReleaseBinding {
  return {
    metadata: { generation } as any,
    status: { conditions: conditions as any },
  } as ReleaseBinding;
}

describe('deriveBindingStatus', () => {
  it('returns NotReady when there are no conditions', () => {
    const binding = makeBinding([]);
    expect(deriveBindingStatus(binding)).toBe('NotReady');
  });

  it('returns NotReady when Ready condition is absent', () => {
    const binding = makeBinding([
      { type: 'ReleaseSynced', status: 'True' },
      { type: 'ResourcesReady', status: 'True' },
    ]);
    expect(deriveBindingStatus(binding)).toBe('NotReady');
  });

  it('returns Ready when Ready condition is True', () => {
    const binding = makeBinding([
      { type: 'Ready', status: 'True', reason: 'Ready' },
    ]);
    expect(deriveBindingStatus(binding)).toBe('Ready');
  });

  it('returns NotReady for ResourcesProgressing reason', () => {
    const binding = makeBinding([
      {
        type: 'Ready',
        status: 'False',
        reason: 'ResourcesProgressing',
        message: 'Deployment rollout in progress',
      },
    ]);
    expect(deriveBindingStatus(binding)).toBe('NotReady');
  });

  it('returns NotReady for JobRunning reason', () => {
    const binding = makeBinding([
      { type: 'Ready', status: 'False', reason: 'JobRunning' },
    ]);
    expect(deriveBindingStatus(binding)).toBe('NotReady');
  });

  it('returns NotReady for ConnectionsPending reason', () => {
    const binding = makeBinding([
      { type: 'Ready', status: 'False', reason: 'ConnectionsPending' },
    ]);
    expect(deriveBindingStatus(binding)).toBe('NotReady');
  });

  it('returns NotReady for ResourcesUnknown reason', () => {
    const binding = makeBinding([
      { type: 'Ready', status: 'False', reason: 'ResourcesUnknown' },
    ]);
    expect(deriveBindingStatus(binding)).toBe('NotReady');
  });

  it('returns NotReady for ResourcesUndeployed reason (intentional undeploy)', () => {
    const binding = makeBinding([
      { type: 'Ready', status: 'False', reason: 'ResourcesUndeployed' },
    ]);
    expect(deriveBindingStatus(binding)).toBe('NotReady');
  });

  it('returns Failed for ResourcesDegraded reason', () => {
    const binding = makeBinding([
      {
        type: 'Ready',
        status: 'False',
        reason: 'ResourcesDegraded',
        message: 'Primary workload is degraded',
      },
    ]);
    expect(deriveBindingStatus(binding)).toBe('Failed');
  });

  it('returns Failed for ResourceApplyFailed reason', () => {
    const binding = makeBinding([
      { type: 'Ready', status: 'False', reason: 'ResourceApplyFailed' },
    ]);
    expect(deriveBindingStatus(binding)).toBe('Failed');
  });

  it('returns Failed for RenderingFailed reason', () => {
    const binding = makeBinding([
      {
        type: 'Ready',
        status: 'False',
        reason: 'RenderingFailed',
        message: 'Failed to render resources: component type validation failed',
      },
    ]);
    expect(deriveBindingStatus(binding)).toBe('Failed');
  });

  it('returns Failed for ComponentNotFound reason', () => {
    const binding = makeBinding([
      { type: 'Ready', status: 'False', reason: 'ComponentNotFound' },
    ]);
    expect(deriveBindingStatus(binding)).toBe('Failed');
  });

  it('returns Failed for JobFailed reason', () => {
    const binding = makeBinding([
      { type: 'Ready', status: 'False', reason: 'JobFailed' },
    ]);
    expect(deriveBindingStatus(binding)).toBe('Failed');
  });

  it('returns Failed for InvalidReleaseConfiguration reason', () => {
    const binding = makeBinding([
      {
        type: 'Ready',
        status: 'False',
        reason: 'InvalidReleaseConfiguration',
      },
    ]);
    expect(deriveBindingStatus(binding)).toBe('Failed');
  });

  it('returns Failed for unknown/unrecognized reasons (default to error)', () => {
    const binding = makeBinding([
      {
        type: 'Ready',
        status: 'False',
        reason: 'SomeNewUnknownReason',
      },
    ]);
    expect(deriveBindingStatus(binding)).toBe('Failed');
  });

  it('filters conditions by observedGeneration', () => {
    // Ready condition has a stale generation - should be filtered out
    const binding = makeBinding(
      [
        {
          type: 'Ready',
          status: 'True',
          reason: 'Ready',
          observedGeneration: 1,
        },
      ],
      2, // current generation is 2
    );
    // The Ready condition is for gen 1 but current is gen 2, so filtered out
    expect(deriveBindingStatus(binding)).toBe('NotReady');
  });

  it('includes conditions with missing observedGeneration', () => {
    const binding = makeBinding(
      [
        {
          type: 'Ready',
          status: 'True',
          reason: 'Ready',
          // no observedGeneration - treated as matching
        },
      ],
      2,
    );
    expect(deriveBindingStatus(binding)).toBe('Ready');
  });
});

describe('deriveBindingStatusDetailed', () => {
  it('returns reason and message for Failed status', () => {
    const binding = makeBinding([
      {
        type: 'Ready',
        status: 'False',
        reason: 'RenderingFailed',
        message: 'component type validation failed: invalid field X',
      },
    ]);
    const result = deriveBindingStatusDetailed(binding);
    expect(result).toEqual({
      status: 'Failed',
      reason: 'RenderingFailed',
      message: 'component type validation failed: invalid field X',
    });
  });

  it('returns reason and message for Ready status', () => {
    const binding = makeBinding([
      {
        type: 'Ready',
        status: 'True',
        reason: 'Ready',
        message: 'All resources healthy',
      },
    ]);
    const result = deriveBindingStatusDetailed(binding);
    expect(result).toEqual({
      status: 'Ready',
      reason: 'Ready',
      message: 'All resources healthy',
    });
  });

  it('returns reason and message for NotReady progressing status', () => {
    const binding = makeBinding([
      {
        type: 'Ready',
        status: 'False',
        reason: 'ResourcesProgressing',
        message: 'Deployment rollout in progress',
      },
    ]);
    const result = deriveBindingStatusDetailed(binding);
    expect(result).toEqual({
      status: 'NotReady',
      reason: 'ResourcesProgressing',
      message: 'Deployment rollout in progress',
    });
  });

  it('returns status without reason/message for empty conditions', () => {
    const binding = makeBinding([]);
    const result = deriveBindingStatusDetailed(binding);
    expect(result).toEqual({ status: 'NotReady' });
  });
});
