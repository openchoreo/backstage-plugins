import openchoreoPlugin from './alpha';

const ALPHA_EXTENSION_NAMES = [
  // backend client
  ['api', 'open-choreo-client'],
  // self-contained response-cache provider
  ['plugin-wrapper', 'query-provider'],
  // entity context menu items (delete + annotation edit)
  ['entity-context-menu-item', 'delete-entity'],
  ['entity-context-menu-item', 'edit-annotations'],
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
  // per-kind Overview layouts
  ['entity-content-layout', 'component-overview'],
  ['entity-content-layout', 'system-overview'],
  ['entity-content-layout', 'domain-overview'],
  ['entity-content-layout', 'resource-overview'],
  ['entity-content-layout', 'environment-overview'],
  ['entity-content-layout', 'dataplane-overview'],
  ['entity-content-layout', 'cluster-dataplane-overview'],
  ['entity-content-layout', 'workflow-plane-overview'],
  ['entity-content-layout', 'cluster-workflow-plane-overview'],
  ['entity-content-layout', 'observability-plane-overview'],
  ['entity-content-layout', 'cluster-observability-plane-overview'],
  ['entity-content-layout', 'deployment-pipeline-overview'],
  ['entity-content-layout', 'component-type-overview'],
  ['entity-content-layout', 'resource-type-overview'],
  ['entity-content-layout', 'project-type-overview'],
  ['entity-content-layout', 'trait-type-overview'],
  ['entity-content-layout', 'workflow-overview-layout'],
  ['entity-content-layout', 'component-workflow-overview-layout'],
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
