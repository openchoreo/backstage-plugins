import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import {
  deriveBindingStatus,
  deriveBindingStatusDetailed,
  transformReleaseBinding,
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

  it('returns NotReady for ReleaseSynced reason while release is not synced', () => {
    const binding = makeBinding([
      {
        type: 'Ready',
        status: 'False',
        reason: 'ReleaseSynced',
        message: 'Release is not synced',
      },
    ]);
    expect(deriveBindingStatus(binding)).toBe('NotReady');
  });

  it('returns NotReady for ResourceDependenciesPending reason on Ready', () => {
    const binding = makeBinding([
      {
        type: 'Ready',
        status: 'False',
        reason: 'ResourceDependenciesPending',
        message: '1 resource dependencies pending, 0 resolved',
      },
    ]);
    expect(deriveBindingStatus(binding)).toBe('NotReady');
  });

  it('returns NotReady for ResourcesNotReady reason', () => {
    const binding = makeBinding([
      {
        type: 'Ready',
        status: 'False',
        reason: 'ResourcesNotReady',
        message: 'Deployment has unavailable replicas',
      },
    ]);
    expect(deriveBindingStatus(binding)).toBe('NotReady');
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

  it('returns NotReady for NamespaceProgressing reason', () => {
    const binding = makeBinding([
      {
        type: 'Ready',
        status: 'False',
        reason: 'NamespaceProgressing',
        message: 'Namespace is still being provisioned',
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

  it('returns NotReady for ProjectReleaseNotSet reason (awaiting pin seeding)', () => {
    const binding = makeBinding([
      {
        type: 'Ready',
        status: 'False',
        reason: 'ProjectReleaseNotSet',
        message:
          'spec.projectRelease is unset; pin a ProjectRelease to deploy this binding',
      },
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

// The hook gate holds a new release back without touching the one already
// running, so a gate reason on Ready must not read as a failed deployment.
// The controller leaves ResourcesReady at the previous generation while it
// blocks, which is what tells "something is serving" apart from a first deploy.
describe('deriveBindingStatus with the deployment-hook gate', () => {
  const gated = (reason: string, serving: boolean) =>
    makeBinding(
      [
        { type: 'Ready', status: 'False', reason, observedGeneration: 5 },
        ...(serving
          ? [
              {
                type: 'ResourcesReady',
                status: 'True',
                reason: 'Ready',
                observedGeneration: 4,
              },
            ]
          : []),
      ],
      5,
    );

  it('is Pending while hooks run for a first deploy', () => {
    expect(deriveBindingStatus(gated('HooksRunning', false))).toBe('NotReady');
  });

  it('stays Active while hooks run for a new release over a serving one', () => {
    expect(deriveBindingStatus(gated('HooksRunning', true))).toBe('Ready');
  });

  it('stays Active when the gate blocks a new release over a serving one', () => {
    for (const reason of ['HookFailed', 'HookTimedOut', 'PlaneUnavailable']) {
      expect(deriveBindingStatus(gated(reason, true))).toBe('Ready');
    }
  });

  it('is Failed when the gate blocks a first deploy', () => {
    expect(deriveBindingStatus(gated('HookFailed', false))).toBe('Failed');
  });

  it('does not treat a non-gate failure as Active because of old resources', () => {
    expect(deriveBindingStatus(gated('RenderingFailed', true))).toBe('Failed');
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

  it('surfaces the suspended reason from ResourcesReady on a Ready binding', () => {
    const binding = makeBinding([
      { type: 'Ready', status: 'True', reason: 'Ready' },
      {
        type: 'ResourcesReady',
        status: 'True',
        reason: 'ReadyWithSuspendedResources',
        message: 'Primary workload Deployment is suspended (scaled to 0)',
      },
    ]);
    const result = deriveBindingStatusDetailed(binding);
    expect(result).toEqual({
      status: 'Ready',
      reason: 'ReadyWithSuspendedResources',
      message: 'Primary workload Deployment is suspended (scaled to 0)',
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

describe('transformReleaseBinding endpoint https prioritization', () => {
  const http = { host: 'api.example.com', port: 80, scheme: 'http' };
  const https = { host: 'api.example.com', port: 443, scheme: 'https' };

  function makeBindingWithEndpoints(endpoints: unknown[]): ReleaseBinding {
    return {
      status: { conditions: [], endpoints },
    } as unknown as ReleaseBinding;
  }

  it('orders https before http in externalURLs', () => {
    const result = transformReleaseBinding(
      makeBindingWithEndpoints([
        { name: 'ep', externalURLs: { plain: http, secure: https } },
      ]),
    );
    const urls = Object.values(result.endpoints![0].externalURLs!);
    expect(urls[0].scheme).toBe('https');
    expect(urls[1].scheme).toBe('http');
  });

  it('orders https before http in internalURLs', () => {
    const result = transformReleaseBinding(
      makeBindingWithEndpoints([
        { name: 'ep', internalURLs: { plain: http, secure: https } },
      ]),
    );
    const urls = Object.values(result.endpoints![0].internalURLs!);
    expect(urls[0].scheme).toBe('https');
  });

  it('preserves order when only http is present', () => {
    const result = transformReleaseBinding(
      makeBindingWithEndpoints([
        { name: 'ep', externalURLs: { a: http, b: { ...http, port: 8080 } } },
      ]),
    );
    const urls = Object.values(result.endpoints![0].externalURLs!);
    expect(urls.map(u => u.port)).toEqual([80, 8080]);
  });

  it('leaves endpoints without URL maps untouched', () => {
    const result = transformReleaseBinding(
      makeBindingWithEndpoints([{ name: 'ep' }]),
    );
    expect(result.endpoints![0]).toEqual({ name: 'ep' });
  });
});
