import {
  ApiBlueprint,
  createFrontendModule,
} from '@backstage/frontend-plugin-api';
import { AppRootWrapperBlueprint } from '@backstage/plugin-app-react';
import { discoveryApiRef } from '@backstage/core-plugin-api';
import {
  openChoreoFetchApiRef,
  portalAssistantIntegrationApiRef,
  type PortalAssistantIntegration,
} from '@openchoreo/backstage-plugin-react';
import { LogRowActionBlueprint } from '@openchoreo/backstage-plugin-openchoreo-observability/alpha';

import { perchAgentApiRef, PerchAgentClient } from './api/PerchAgentApi';
import { AssistantDrawerProvider } from './components/AssistantContext/AssistantDrawerContext';
import { FailedBuildSnackbar } from './components/FailedBuildSnackbar/FailedBuildSnackbar';
import { InvestigateLogButton } from './components/InvestigateLogButton/InvestigateLogButton';
import { InvestigateDependencyButton } from './components/InvestigateDependencyButton/InvestigateDependencyButton';

// Mounts the assistant drawer around the whole app so `useAssistantDrawer`
// works from any surface that opens it.
const assistantDrawerWrapper = AppRootWrapperBlueprint.make({
  name: 'assistant-drawer',
  params: { component: AssistantDrawerProvider },
});

// NOTE: `perchAgentApiRef` is also declared on `openchoreoPerchPlugin.apis`
// in ./plugin.ts. That declaration is NOT picked up at runtime because the
// plugin only exports plain React components and never registers a routable
// or component extension, so the plugin loader never visits its `apis` array.
// Removing this factory causes NotImplementedError in AssistantDrawerProvider.
const portalAssistantService = ApiBlueprint.make({
  name: 'portal-assistant-service',
  params: defineParams =>
    defineParams({
      api: perchAgentApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        // The agent is reached in direct mode, so this must be the
        // OpenChoreo-scoped fetch API that carries the IDP token.
        fetchApi: openChoreoFetchApiRef,
      },
      factory: ({ discoveryApi, fetchApi }) =>
        new PerchAgentClient({ discoveryApi, fetchApi }),
    }),
});

// Fills the `portalAssistantIntegrationApiRef` slots the OpenChoreo plugins
// expose: the failed-build notifier (Overview/Build tabs) and the deploy-panel
// "Investigate with AI" action. `AppWrapper` is unset — the drawer provider is
// already mounted via `assistantDrawerWrapper` above.
const assistantIntegration = ApiBlueprint.make({
  name: 'portal-assistant-integration',
  params: defineParams =>
    defineParams({
      api: portalAssistantIntegrationApiRef,
      deps: {},
      factory: (): PortalAssistantIntegration => ({
        BuildFailureNotifier: FailedBuildSnackbar,
        renderInvestigateAction: scope => (
          <InvestigateDependencyButton {...scope} />
        ),
      }),
    }),
});

// Per-row "investigate" action for the observability runtime-logs tables.
// Registered here rather than inside the observability plugin so observability
// owns no dependency on the assistant — the host composes the two.
const investigateLogAction = LogRowActionBlueprint.make({
  name: 'investigate-log',
  params: {
    renderer: (log, getLogsSnapshot) => (
      <InvestigateLogButton log={log} getLogsSnapshot={getLogsSnapshot} />
    ),
  },
});

/**
 * Everything the Portal Assistant (Perch) contributes to a host app.
 *
 * The assistant is a PRIVATE plugin, and keeping its wiring here rather than in
 * `@openchoreo/backstage-portal-app` means the published shell carries no
 * dependency on it — a portal that should not ship the assistant simply drops
 * the install. `packages/app` installs this module explicitly today.
 *
 * It is also the package's *default* export, which is the shape frontend
 * feature discovery requires: a host that enables `app.packages` in app-config
 * would pick the assistant up from the dependency alone, with no `features`
 * array. Enabling that is tracked separately — don't move this default.
 */
export const assistantFeature = createFrontendModule({
  pluginId: 'app',
  extensions: [
    assistantDrawerWrapper,
    portalAssistantService,
    assistantIntegration,
    investigateLogAction,
  ],
});

export default assistantFeature;
