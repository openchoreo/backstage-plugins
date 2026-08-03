import observabilityPlugin, {
  LogRowActionBlueprint,
  logRowActionRendererApiRef,
} from './alpha';

describe('openchoreo-observability alpha plugin', () => {
  it('registers under the openchoreo-observability plugin id', () => {
    expect((observabilityPlugin as any).id).toBe('openchoreo-observability');
  });

  it('re-exports the LogRowActionBlueprint and renderer api ref', () => {
    expect(LogRowActionBlueprint).toBeDefined();
    expect(LogRowActionBlueprint.dataRefs.renderer).toBeDefined();
    expect(logRowActionRendererApiRef.id).toBe(
      'plugin.openchoreo-observability.log-row-action-renderer',
    );
  });

  it('exposes the expected blueprint extensions', () => {
    const extensions = (observabilityPlugin as any).extensions as Array<{
      id: string;
    }>;
    expect(Array.isArray(extensions)).toBe(true);

    const ids = extensions.map(e => e.id);
    const plugin = 'openchoreo-observability';
    for (const expected of [
      // backend client apis
      `api:${plugin}/observability`,
      // self-contained response-cache provider
      `plugin-wrapper:${plugin}/query-provider`,
      `api:${plugin}/rca-agent`,
      `api:${plugin}/finops-agent`,
      // host-injection registry
      `api:${plugin}/log-row-action-renderer`,
      // component-page entity tabs
      `entity-content:${plugin}/runtime-logs`,
      `entity-content:${plugin}/runtime-events`,
      `entity-content:${plugin}/metrics`,
      `entity-content:${plugin}/alerts`,
      `entity-content:${plugin}/wirelogs`,
      // system-page entity tabs
      `entity-content:${plugin}/project-runtime-logs`,
      `entity-content:${plugin}/traces`,
      `entity-content:${plugin}/project-incidents`,
      `entity-content:${plugin}/rca-reports`,
      `entity-content:${plugin}/cost-analysis`,
    ]) {
      expect(ids).toContain(expected);
    }
  });
});
