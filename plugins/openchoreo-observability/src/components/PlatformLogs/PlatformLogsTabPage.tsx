import { Content } from '@backstage/core-components';
import { PlatformLogsContent } from './PlatformLogsContent';

/**
 * The Logs tab of the Platform section: logs from OpenChoreo's own system components,
 * and from anything else the observability plane collects.
 *
 * Body only — the title and tab bar come from the page this is attached to as a
 * sub-page, `page:platform-engineer-core/platform-overview`. No `<Page>` wrapper:
 * the sub-page renders as a sibling of that page's header, so a `<Page>` (which is
 * `height: 100vh`) would push the viewport down by the height of the header.
 */
export const PlatformLogsTabPage = () => (
  <Content>
    <PlatformLogsContent />
  </Content>
);
