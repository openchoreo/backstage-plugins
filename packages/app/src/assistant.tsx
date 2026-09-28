import {
  ApiBlueprint,
  createFrontendModule,
} from '@backstage/frontend-plugin-api';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import {
  portalAssistantIntegrationApiRef,
  PortalAssistantIntegration,
} from '@openchoreo/backstage-portal-app';
import { LogRowActionBlueprint } from '@openchoreo/backstage-plugin-openchoreo-observability/alpha';
import {
  AssistantDrawerProvider,
  FailedBuildSnackbar,
  InvestigateDependencyButton,
  InvestigateLogButton,
  PerchAgentClient,
  perchAgentApiRef,
} from '@openchoreo/backstage-plugin-openchoreo-portal-assistant';

// What the assistant contributes to the shell's optional integration slots:
// the global drawer provider, the failed-build prompt on entity Overview and
// Build tabs, and the deploy panel's investigate action.
export const assistantIntegration: PortalAssistantIntegration = {
  AppWrapper: AssistantDrawerProvider,
  BuildFailureNotifier: FailedBuildSnackbar,
  renderInvestigateAction: scope => <InvestigateDependencyButton {...scope} />,
};

/**
 * Wires the Portal Assistant (Perch) into the portal shell. The assistant is
 * a PRIVATE plugin — deliberately not part of the published
 * `@openchoreo/backstage-portal-app` bundle — so the stock portal injects it
 * here, mirroring how packages/backend adds the assistant backend outside
 * `portalBackendFeatures`. A custom portal scaffold simply omits this module.
 */
export const assistantFeature = createFrontendModule({
  pluginId: 'app',
  extensions: [
    // Perch agent client. NOTE: ``perchAgentApiRef`` is also declared on
    // ``openchoreoPerchPlugin.apis``, but that declaration is never picked
    // up at runtime — the plugin exports plain React components and never
    // registers a routable or component extension, so the plugin loader
    // never visits its ``apis`` array. This factory is the one actually
    // wired in; removing it causes ``NotImplementedError: No implementation
    // available for apiRef{plugin.openchoreo-portal-assistant.service}`` in
    // AssistantDrawerProvider.
    ApiBlueprint.make({
      name: 'perch-agent',
      params: defineParams =>
        defineParams({
          api: perchAgentApiRef,
          deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
          factory: ({ discoveryApi, fetchApi }) =>
            new PerchAgentClient({ discoveryApi, fetchApi }),
        }),
    }),
    ApiBlueprint.make({
      name: 'assistant-integration',
      params: defineParams =>
        defineParams({
          api: portalAssistantIntegrationApiRef,
          deps: {},
          factory: () => assistantIntegration,
        }),
    }),
    // Per-row "investigate" action for the observability runtime-logs tables.
    // Registered here (not inside the observability plugin) so observability
    // owns no dependency on perch — the host composes the two.
    LogRowActionBlueprint.make({
      name: 'investigate-log',
      params: {
        renderer: (log, getLogsSnapshot) => (
          <InvestigateLogButton log={log} getLogsSnapshot={getLogsSnapshot} />
        ),
      },
    }),
  ],
});
