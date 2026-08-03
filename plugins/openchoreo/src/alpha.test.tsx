import openchoreoPlugin from './alpha';

const ALPHA_EXTENSION_NAMES = [
  // backend client
  ['api', 'open-choreo-client'],
  // self-contained response-cache provider
  ['plugin-wrapper', 'query-provider'],
  // shared
  ['entity-content', 'resource-definition'],
  // component-page
  ['entity-content', 'component-deploy'],
  ['entity-card', 'deployment-status'],
  ['entity-card', 'runtime-health'],
  // system-page
  ['entity-content', 'cell-diagram'],
  ['entity-card', 'project-contents'],
  ['entity-card', 'deployment-pipeline'],
  // domain-page
  ['entity-card', 'namespace-projects'],
  ['entity-card', 'namespace-resources'],
  // managed resource
  ['entity-content', 'resource-deploy'],
  ['entity-card', 'resource-parameters'],
  ['entity-card', 'resource-deployments'],
  ['entity-card', 'consuming-components'],
  // environment
  ['entity-card', 'environment-status-summary'],
  ['entity-card', 'environment-promotion'],
  ['entity-card', 'environment-deployed-components'],
  ['entity-card', 'environment-gateway-configuration'],
  // dataplane
  ['entity-card', 'dataplane-status'],
  ['entity-card', 'dataplane-environments'],
  ['entity-card', 'dataplane-gateway-configuration'],
  ['entity-card', 'cluster-dataplane-status'],
  ['entity-card', 'cluster-dataplane-environments'],
  ['entity-card', 'cluster-dataplane-gateway-configuration'],
  // workflow plane
  ['entity-card', 'workflow-plane-status'],
  ['entity-card', 'cluster-workflow-plane-status'],
  // observability plane
  ['entity-card', 'observability-plane-status'],
  ['entity-card', 'observability-plane-linked-planes'],
  ['entity-card', 'cluster-observability-plane-status'],
  ['entity-card', 'cluster-observability-plane-linked-planes'],
  // deployment pipeline
  ['entity-card', 'deployment-pipeline-visualization'],
  ['entity-card', 'promotion-paths'],
  // type families
  ['entity-card', 'component-type-overview'],
  ['entity-card', 'resource-type-overview'],
  ['entity-card', 'trait-type-overview'],
  // workflow family
  ['entity-card', 'workflow-overview'],
  ['entity-card', 'component-workflow-overview'],
] as const;

describe('openchoreo alpha plugin', () => {
  it('registers under the openchoreo plugin id', () => {
    expect((openchoreoPlugin as any).id).toBe('openchoreo');
  });

  it('exposes the documented blueprint extensions', () => {
    const extensions = (openchoreoPlugin as any).extensions as Array<{
      id: string;
    }>;
    expect(Array.isArray(extensions)).toBe(true);

    const ids = extensions.map(e => e.id);
    for (const [kind, name] of ALPHA_EXTENSION_NAMES) {
      expect(ids).toContain(`${kind}:openchoreo/${name}`);
    }
  });

  it('exposes one extension per documented entry (no silent drops)', () => {
    const extensions = (openchoreoPlugin as any).extensions as Array<unknown>;
    expect(extensions).toHaveLength(ALPHA_EXTENSION_NAMES.length);
  });
});
