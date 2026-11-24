import {
  ApiBlueprint,
  createFrontendModule,
} from '@backstage/frontend-plugin-api';
import { AppRootWrapperBlueprint } from '@backstage/plugin-app-react';
import { discoveryApiRef, identityApiRef } from '@backstage/core-plugin-api';
import {
  openChoreoFetchApiRef,
  portalAssistantIntegrationApiRef,
  type PortalAssistantIntegration,
} from '@openchoreo/backstage-plugin-react';
import { LogRowActionBlueprint } from '@openchoreo/backstage-plugin-openchoreo-observability/alpha';
import { checkAuthoringAssistantApiRef } from '@openchoreo/backstage-plugin-tech-insights-scorecards';

import {
  portalAssistantApiRef,
  PortalAssistantClient,
} from './api/PortalAssistantApi';
import { AssistantDrawerProvider } from './components/AssistantContext/AssistantDrawerContext';
import { FailedBuildSnackbar } from './components/FailedBuildSnackbar/FailedBuildSnackbar';
import { InvestigateLogButton } from './components/InvestigateLogButton/InvestigateLogButton';
import { InvestigateDependencyButton } from './components/InvestigateDependencyButton/InvestigateDependencyButton';
import {
  EditCheckWithAiButton,
  NewCheckLauncher,
} from './components/AskPortalAssistantButton/AskPortalAssistantButton';

// Mounts the assistant drawer around the whole app so `useAssistantDrawer`
// works from any surface that opens it.
const assistantDrawerWrapper = AppRootWrapperBlueprint.make({
  name: 'assistant-drawer',
  params: { component: AssistantDrawerProvider },
});

// NOTE: `portalAssistantApiRef` is also declared on `openchoreoPortalAssistantPlugin.apis`
// in ./plugin.ts. That declaration is NOT picked up at runtime because the
// plugin only exports plain React components and never registers a routable
// or component extension, so the plugin loader never visits its `apis` array.
// Removing this factory causes NotImplementedError in AssistantDrawerProvider.
const portalAssistantService = ApiBlueprint.make({
  name: 'portal-assistant-service',
  params: defineParams =>
    defineParams({
      api: portalAssistantApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        // The agent is reached in direct mode, so this must be the
        // OpenChoreo-scoped fetch API that carries the IDP token.
        fetchApi: openChoreoFetchApiRef,
        // The user's Backstage token, for the forwarder to act on their
        // behalf (see PortalAssistantClient.streamChat).
        identityApi: identityApiRef,
      },
      factory: ({ discoveryApi, fetchApi, identityApi }) =>
        new PortalAssistantClient({ discoveryApi, fetchApi, identityApi }),
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

// "Generate with AI" in the scorecards "Create check" menu and "Edit with AI"
// when editing a check. Same composition as above: the scorecards plugin only
// exposes the slot and owns no dependency on the assistant.
const checkAuthoringAssistant = ApiBlueprint.make({
  name: 'check-authoring-assistant',
  params: defineParams =>
    defineParams({
      api: checkAuthoringAssistantApiRef,
      deps: {},
      factory: () => ({
        LaunchButton: EditCheckWithAiButton,
        NewCheckLauncher,
      }),
    }),
});

/**
 * Everything the Portal Assistant contributes to a host app.
 *
 * The assistant is a PRIVATE plugin, and keeping its wiring here rather than in
 * `@openchoreo/backstage-portal-app` means the published shell carries no
 * dependency on it — a portal that should not ship the assistant simply drops
 * the install.
 *
 * It is also the package's *default* export, which is the shape frontend
 * feature discovery requires. `packages/app` has `app.packages: all`, so the
 * assistant is installed from the dependency alone, with no `features` array
 * and no import — don't move this default, nothing else is read.
 */
export const assistantFeature = createFrontendModule({
  pluginId: 'app',
  extensions: [
    assistantDrawerWrapper,
    portalAssistantService,
    assistantIntegration,
    investigateLogAction,
    checkAuthoringAssistant,
  ],
});

export default assistantFeature;
