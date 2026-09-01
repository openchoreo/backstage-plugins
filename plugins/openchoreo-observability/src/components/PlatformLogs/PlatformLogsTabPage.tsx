import { Content } from '@backstage/core-components';
import { PlatformPageShell } from '@openchoreo/backstage-plugin-react';
import { PlatformLogsContent } from './PlatformLogsContent';

/**
 * The Logs tab of the Platform section: logs from OpenChoreo's own components, and
 * from anything else the observability plane collects.
 *
 * The page chrome is the shared {@link PlatformPageShell}, so this tab and the Platform
 * Overview tab (owned by the platform-engineer-core plugin) render one header and one
 * tab bar between them.
 */
export const PlatformLogsTabPage = () => (
  <PlatformPageShell subtitle="Logs from OpenChoreo's own components and everything else the observability plane collects">
    <Content>
      <PlatformLogsContent />
    </Content>
  </PlatformPageShell>
);
