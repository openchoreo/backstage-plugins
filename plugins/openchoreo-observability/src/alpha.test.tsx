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
      `entity-content:${plugin}/project-cost-analysis`,
      // overview cards
      `entity-card:${plugin}/cost-insights-summary`,
      // Logs tab of the Platform section, attached to platform-engineer-core's page
      `sub-page:${plugin}/platform-logs`,
    ]) {
      expect(ids).toContain(expected);
    }
  });

  // The attach point is a bare extension-id string with no compile-time check, and a
  // wrong one fails silently — the node is collected as an orphan and the tab simply
  // never appears. Pin it.
  it('attaches the platform logs tab to the platform-engineer-core page', () => {
    const extensions = (observabilityPlugin as any).extensions as Array<{
      id: string;
      attachTo: { id: string; input: string };
    }>;

    const logsTab = extensions.find(
      e => e.id === 'sub-page:openchoreo-observability/platform-logs',
    );

    expect(logsTab?.attachTo).toEqual({
      id: 'page:platform-engineer-core/platform-overview',
      input: 'pages',
    });
  });
});
