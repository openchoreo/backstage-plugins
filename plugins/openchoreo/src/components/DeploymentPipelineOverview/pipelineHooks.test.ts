import type { HookSet } from '@openchoreo/backstage-plugin-common';
import { hooksOfEnvironment, pipelineEnvironmentHooks } from './pipelineHooks';

describe('hooksOfEnvironment', () => {
  it('lists pre-deploy before post-deploy and links each to its hook entity', () => {
    expect(
      hooksOfEnvironment(
        {
          preDeploy: [
            {
              name: 'image-scan',
              hookRef: { kind: 'ClusterHook', name: 'trivy-image-scan' },
            },
          ],
          postDeploy: [{ name: 'notify', hookRef: { name: 'slack-notify' } }],
        } as HookSet,
        'team-a',
      ),
    ).toEqual([
      {
        key: 'pre-image-scan',
        name: 'image-scan',
        phase: 'pre',
        effect: 'blocks',
        // ClusterHook entities live in the cluster namespace; Hooks in the pipeline's.
        to: '/catalog/openchoreo-cluster/clusterhook/trivy-image-scan',
      },
      {
        key: 'post-notify',
        name: 'notify',
        phase: 'post',
        effect: 'waits',
        to: '/catalog/team-a/hook/slack-notify',
      },
    ]);
    expect(hooksOfEnvironment(undefined, 'ns')).toEqual([]);
  });

  // The pipeline lanes colour blocking hooks differently, so a wrong default
  // would tell users a hook gates their deploy when it does not (or vice versa).
  it('derives the effect from the CRD defaults: pre blocks, post is ignored, Async runs in background', () => {
    const effects = hooksOfEnvironment(
      {
        preDeploy: [
          { name: 'p-default', hookRef: { name: 'h' } },
          { name: 'p-ignore', hookRef: { name: 'h' }, onFailure: 'Ignore' },
          { name: 'p-async', hookRef: { name: 'h' }, mode: 'Async' },
        ],
        postDeploy: [
          { name: 'q-default', hookRef: { name: 'h' } },
          { name: 'q-alert', hookRef: { name: 'h' }, onFailure: 'Alert' },
        ],
      } as HookSet,
      'ns',
    ).map(h => [h.name, h.effect]);
    expect(effects).toEqual([
      ['p-default', 'blocks'],
      ['p-ignore', 'waits'],
      ['p-async', 'background'],
      ['q-default', 'waits'],
      ['q-alert', 'alerts'],
    ]);
  });
});

describe('pipelineEnvironmentHooks', () => {
  it('keys bindings by environment and leaves out environments without any', () => {
    const result = pipelineEnvironmentHooks(
      new Map<string, HookSet>([
        ['prod', { preDeploy: [{ name: 'scan', hookRef: { name: 'h' } }] }],
        ['dev', { preDeploy: [], postDeploy: [] }],
      ] as [string, HookSet][]),
      'ns',
    );
    expect(Object.keys(result)).toEqual(['prod']);
    expect(result.prod.map(h => h.key)).toEqual(['pre-scan']);
  });
});
