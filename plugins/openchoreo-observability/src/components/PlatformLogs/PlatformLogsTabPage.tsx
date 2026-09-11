import { Content } from '@backstage/core-components';
import { PlatformLogsContent } from './PlatformLogsContent';

/**
 * The Logs tab of the Platform section: logs from OpenChoreo's own system components,
 * and from anything else the observability plane collects.
 *
 * Body only — the `<Page>`, title and tab bar come from the page this is attached
 * to as a sub-page, `page:platform-engineer-core/platform-overview`, so this
 * supplies just its own `<Content>`.
 */
export const PlatformLogsTabPage = () => (
  <Content>
    <PlatformLogsContent />
  </Content>
);
