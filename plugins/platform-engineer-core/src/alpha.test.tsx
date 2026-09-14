import platformEngineerCorePlugin from './alpha';

const extensions = (platformEngineerCorePlugin as any).extensions as Array<{
  id: string;
  attachTo: { id: string; input: string };
}>;

const PLATFORM_PAGE = 'page:platform-engineer-core/platform-overview';
const OVERVIEW_TAB = 'sub-page:platform-engineer-core/overview';

describe('platform-engineer-core alpha plugin', () => {
  it('registers under the platform-engineer-core plugin id', () => {
    expect((platformEngineerCorePlugin as any).id).toBe(
      'platform-engineer-core',
    );
  });

  it('exposes the expected blueprint extensions', () => {
    const ids = extensions.map(e => e.id);
    const plugin = 'platform-engineer-core';

    for (const expected of [
      `plugin-wrapper:${plugin}/query-provider`,
      `page:${plugin}/platform-engineer-dashboard`,
      // Host page of the Platform section, plus its own Overview tab.
      PLATFORM_PAGE,
      OVERVIEW_TAB,
    ]) {
      expect(ids).toContain(expected);
    }
  });

  // The attach point is a bare extension-id string with no compile-time check, and
  // getting it wrong fails silently — the node is collected as an orphan and the tab
  // simply never appears. openchoreo-observability pins the same target from its side
  // for its Logs tab; renaming this page breaks both.
  it('attaches the Overview tab to the Platform page', () => {
    const tab = extensions.find(e => e.id === OVERVIEW_TAB);

    expect(tab?.attachTo).toEqual({ id: PLATFORM_PAGE, input: 'pages' });
  });
});
