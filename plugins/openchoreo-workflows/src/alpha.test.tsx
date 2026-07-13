import workflowsPlugin from './alpha';

describe('openchoreo-workflows alpha plugin', () => {
  it('registers under the openchoreo-workflows plugin id', () => {
    expect((workflowsPlugin as any).id).toBe('openchoreo-workflows');
  });

  it('exposes the expected blueprint extensions', () => {
    const extensions = (workflowsPlugin as any).extensions as Array<{
      id: string;
    }>;
    expect(Array.isArray(extensions)).toBe(true);

    const ids = extensions.map(e => e.id);
    const plugin = 'openchoreo-workflows';
    for (const expected of [
      `api:${plugin}/generic-workflows-client`,
      `plugin-wrapper:${plugin}/query-provider`,
      `page:${plugin}/generic-workflows`,
      `entity-content:${plugin}/workflow-runs`,
    ]) {
      expect(ids).toContain(expected);
    }
  });
});
