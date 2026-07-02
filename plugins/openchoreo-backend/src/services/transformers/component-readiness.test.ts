import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import { deriveComponentReadiness } from './component-readiness';

type Component = OpenChoreoComponents['schemas']['Component'];

function makeComponent(
  conditions: Array<{
    type: string;
    status: string;
    reason?: string;
    message?: string;
    observedGeneration?: number;
  }>,
  generation?: number,
): Component {
  return {
    metadata: { generation } as any,
    status: { conditions: conditions as any },
  } as Component;
}

describe('deriveComponentReadiness', () => {
  it('reports no error when there are no conditions', () => {
    expect(deriveComponentReadiness(makeComponent([]))).toEqual({
      hasError: false,
    });
  });

  it('reports no error when the Ready condition is absent', () => {
    const component = makeComponent([{ type: 'Synced', status: 'True' }]);
    expect(deriveComponentReadiness(component).hasError).toBe(false);
  });

  it('reports no error when Ready is True', () => {
    const component = makeComponent([
      { type: 'Ready', status: 'True', reason: 'Reconciled' },
    ]);
    expect(deriveComponentReadiness(component).hasError).toBe(false);
  });

  it('reports no error when Ready is Unknown', () => {
    const component = makeComponent([{ type: 'Ready', status: 'Unknown' }]);
    expect(deriveComponentReadiness(component).hasError).toBe(false);
  });

  it.each([
    'AutoDeployFailed',
    'TraitNotFound',
    'RenderingFailed',
    'InvalidConfiguration',
    'WorkloadNotFound',
  ])('flags Ready=False with reason %s as an error', reason => {
    const component = makeComponent([
      {
        type: 'Ready',
        status: 'False',
        reason,
        message: `controller said ${reason}`,
      },
    ]);
    const result = deriveComponentReadiness(component);
    expect(result.hasError).toBe(true);
    expect(result.reason).toBe(reason);
    expect(result.message).toBe(`controller said ${reason}`);
  });

  it.each(['Progressing', 'Reconciling', 'ResourcesProgressing'])(
    'does not flag a transient (progressing) Ready=False reason %s as an error',
    reason => {
      const component = makeComponent([
        { type: 'Ready', status: 'False', reason },
      ]);
      expect(deriveComponentReadiness(component).hasError).toBe(false);
    },
  );

  it('ignores conditions observed for a stale generation', () => {
    const component = makeComponent(
      [
        {
          type: 'Ready',
          status: 'False',
          reason: 'AutoDeployFailed',
          observedGeneration: 1,
        },
      ],
      2,
    );
    // The only Ready condition is for an old generation → no current Ready → no error.
    expect(deriveComponentReadiness(component).hasError).toBe(false);
  });

  it('honours a condition whose observedGeneration matches', () => {
    const component = makeComponent(
      [
        {
          type: 'Ready',
          status: 'False',
          reason: 'AutoDeployFailed',
          message: 'boom',
          observedGeneration: 2,
        },
      ],
      2,
    );
    expect(deriveComponentReadiness(component)).toEqual({
      hasError: true,
      reason: 'AutoDeployFailed',
      message: 'boom',
    });
  });
});
