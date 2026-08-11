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
import { Fragment, PropsWithChildren } from 'react';
import { OpenChoreoQueryProvider } from '@openchoreo/backstage-plugin-react';
import { usePortalAssistant } from './assistant/PortalAssistantIntegrationApi';
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

// Wraps the app root so page overrides attaching under upstream plugin
// scopes (page:catalog/entity, page:api-docs, ...) inherit query context.
const openChoreoQueryWrapper = AppRootWrapperBlueprint.make({
  name: 'openchoreo-query',
  params: { component: OpenChoreoQueryProvider },
});

const scaffolderPreselectionWrapper = AppRootWrapperBlueprint.make({
  name: 'scaffolder-preselection',
  params: { component: ScaffolderPreselectionProvider },
});

// Assistant drawer slot — the shell has no dependency on any assistant
// implementation; hosts register one via `portalAssistantIntegrationApiRef`.
// Falls back to a Fragment so the tree is identical when no assistant is
// installed.
const AssistantAppWrapper = ({ children }: PropsWithChildren<{}>) => {
  const { AppWrapper = Fragment } = usePortalAssistant();
  return <AppWrapper>{children}</AppWrapper>;
};

const assistantDrawerWrapper = AppRootWrapperBlueprint.make({
  name: 'assistant-drawer',
  params: { component: AssistantAppWrapper },
});

// Portal-only. Adopters get vanilla upstream api-docs behavior on API pages.
const apiTryOutEntityContent = EntityContentBlueprint.make({
  name: 'api-try-out',
  params: {
    path: '/try-out',
    title: 'Try Out',
    group: 'runtime',
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
    openChoreoQueryWrapper,
    scaffolderPreselectionWrapper,
    assistantDrawerWrapper,
    apiTryOutEntityContent,
    apiOverviewLayout,
  ],
});
