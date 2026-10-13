import { transformHook, transformClusterHook, toHookSpec } from './hook';

// The hook's parameter mapping decides what a binding may override, so the
// transformer must carry every source field through verbatim; a dropped
// `overridable` or `required` would silently change what the pipeline form
// offers.
describe('hook transformers', () => {
  const spec = {
    type: 'Workflow' as const,
    workflowRef: { kind: 'ClusterWorkflow' as const, name: 'trivy-image-scan' },
    enabledTo: [{ kind: 'ClusterComponentType' as const, name: 'service' }],
    parameters: [
      { name: 'image', from: '${deployment.workload.containers.main.image}' },
      { name: 'severity', default: 'CRITICAL' },
      {
        name: 'ignoreUnfixed',
        from: '${deployment.environment.name}',
        overridable: true,
      },
      { name: 'ticket', required: true },
      { name: 'registry', value: 'harbor' },
    ],
  };

  it('carries every parameter source and enabledTo through', () => {
    const out = toHookSpec(spec as any);
    expect(out.workflowRef).toEqual({
      kind: 'ClusterWorkflow',
      name: 'trivy-image-scan',
    });
    expect(out.enabledTo).toEqual([
      { kind: 'ClusterComponentType', name: 'service' },
    ]);
    expect(out.parameters).toEqual(spec.parameters);
  });

  it('transforms a namespaced Hook with its namespace', () => {
    const out = transformHook({
      metadata: {
        name: 'slack-notify',
        namespace: 'default',
        creationTimestamp: '2026-09-23T00:00:00Z',
        annotations: { 'openchoreo.dev/display-name': 'Slack notify' },
      },
      spec,
    } as any);
    expect(out.name).toBe('slack-notify');
    expect(out.namespaceName).toBe('default');
    expect(out.displayName).toBe('Slack notify');
    expect(out.createdAt).toBe('2026-09-23T00:00:00Z');
    expect(out.spec.parameters).toHaveLength(5);
  });

  it('transforms a ClusterHook without a namespace', () => {
    const out = transformClusterHook({
      metadata: {
        name: 'trivy-image-scan',
        creationTimestamp: '2026-09-23T00:00:00Z',
      },
      spec,
    } as any);
    expect(out).not.toHaveProperty('namespaceName');
    expect(out.name).toBe('trivy-image-scan');
    expect(out.spec.enabledTo).toHaveLength(1);
  });

  it('defaults a missing workflowRef kind to ClusterWorkflow (CRD default)', () => {
    const out = toHookSpec({ workflowRef: { name: 'wf' } } as any);
    expect(out.workflowRef).toEqual({ kind: 'ClusterWorkflow', name: 'wf' });
    expect(out.parameters).toBeUndefined();
  });
});
