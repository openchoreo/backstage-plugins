import {
  ApiBlueprint,
  createFrontendModule,
} from '@backstage/frontend-plugin-api';
import {
  AppRootWrapperBlueprint,
  IconBundleBlueprint,
  NavContentBlueprint,
  ThemeBlueprint,
} from '@backstage/plugin-app-react';
import {
  EntityContentBlueprint,
  EntityContentLayoutBlueprint,
} from '@backstage/plugin-catalog-react/alpha';
import {
  AssistantDrawerProvider,
  FailedBuildSnackbar,
  InvestigateDependencyButton,
} from '@openchoreo/backstage-plugin-openchoreo-portal-assistant';
import {
  portalAssistantIntegrationApiRef,
  type PortalAssistantIntegration,
} from '@openchoreo/backstage-plugin-react';
import { apis } from './apis';
import { LEGACY_KIND_ICONS } from './kindIcons';
import { appThemes } from './themes';
import { PortalNavContent } from './components/Root/PortalNavContent';
import { ScaffolderPreselectionProvider } from '@openchoreo/backstage-plugin';

const apiExtensions = apis.map(factory =>
  ApiBlueprint.make({
    name: factory.api.id,
    params: defineParams => defineParams(factory),
  }),
);

const iconBundle = IconBundleBlueprint.make({
  name: 'kind-icons',
  params: { icons: LEGACY_KIND_ICONS },
});

const themeExtensions = appThemes.map(theme =>
  ThemeBlueprint.make({
    name: theme.id,
    params: { theme },
  }),
);

const navContent = NavContentBlueprint.make({
  params: { component: PortalNavContent },
});

const scaffolderPreselectionWrapper = AppRootWrapperBlueprint.make({
  name: 'scaffolder-preselection',
  params: { component: ScaffolderPreselectionProvider },
});

const assistantDrawerWrapper = AppRootWrapperBlueprint.make({
  name: 'assistant-drawer',
  params: { component: AssistantDrawerProvider },
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

// Portal-only. Adopters get vanilla upstream api-docs behavior on API pages.
const apiTryOutEntityContent = EntityContentBlueprint.make({
  name: 'api-try-out',
  params: {
    path: '/try-out',
    title: 'Try Out',
    group: 'api-try-out',
    filter: { kind: 'api' },
    loader: () =>
      import('@openchoreo/backstage-plugin').then(m => <m.ApiTryOut />),
  },
});

const apiOverviewLayout = EntityContentLayoutBlueprint.make({
  name: 'api-overview',
  params: {
    filter: { kind: 'api' },
    loader: () =>
      import('./components/apiOverview/ApiOverviewLayout').then(m => m.default),
  },
});

// Attached to pluginId 'app'. Required for theme / icon / nav-content /
// root-wrapper extensions since those inputs on plugin-app are `internal`
// and only accept contributions from a module of the 'app' plugin.
export const appModule = createFrontendModule({
  pluginId: 'app',
  extensions: [
    ...apiExtensions,
    iconBundle,
    ...themeExtensions,
    navContent,
    scaffolderPreselectionWrapper,
    assistantDrawerWrapper,
    assistantIntegration,
    apiTryOutEntityContent,
    apiOverviewLayout,
  ],
});
