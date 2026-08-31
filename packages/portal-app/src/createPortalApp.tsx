import { Route } from 'react-router-dom';
import Grid from '@material-ui/core/Grid';
import { catalogPlugin } from '@backstage/plugin-catalog';
import { catalogImportPlugin } from '@backstage/plugin-catalog-import';
import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { SearchPage } from '@backstage/plugin-search';
import {
  TechDocsIndexPage,
  techdocsPlugin,
  TechDocsReaderPage,
} from '@backstage/plugin-techdocs';
import { TechDocsAddons } from '@backstage/plugin-techdocs-react';
import { ReportIssue } from '@backstage/plugin-techdocs-module-addons-contrib';
import { apis } from './apis';
import { CustomApiExplorerPage } from './components/catalog/CustomApiExplorerPage';
import { CustomCatalogImportPage } from './components/catalog/CustomCatalogImportPage';
import { searchPage } from './components/search/SearchPage';
import { Root } from './components/Root';
import { HomePage } from './components/Home';
import { CustomGraphNode } from '@openchoreo/backstage-plugin-react';
import { PageLoader } from '@openchoreo/backstage-design-system';
import { PlatformOverviewPage } from './components/platformOverview';
import {
  CostInsightsPage,
  DeliveryInsightsPage,
} from '@openchoreo/backstage-plugin-openchoreo-observability';

import { AlertDisplay, OAuthRequestDialog } from '@backstage/core-components';
import { createApp } from '@backstage/frontend-defaults';
import type { FrontendFeature } from '@backstage/frontend-plugin-api';
import {
  convertLegacyAppOptions,
  convertLegacyAppRoot,
} from '@backstage/core-compat-api';
import { AppRouter, FlatRoutes } from '@backstage/core-app-api';

// NFS plugin features (created in Step 2 — each plugin's `/alpha` exports a
// `createFrontendPlugin` instance). These replace the API factory entries
// that previously lived in `apis.ts`.
import openchoreoPluginAlpha, {
  openChoreoEntityPageOverride,
} from '@openchoreo/backstage-plugin/alpha';
import openchoreoCiPluginAlpha from '@openchoreo/backstage-plugin-openchoreo-ci/alpha';
import openchoreoObservabilityPluginAlpha from '@openchoreo/backstage-plugin-openchoreo-observability/alpha';
import openchoreoWorkflowsPluginAlpha from '@openchoreo/backstage-plugin-openchoreo-workflows/alpha';
import platformEngineerCorePluginAlpha from '@openchoreo/backstage-plugin-platform-engineer-core/alpha';

// Upstream NFS plugin features with our overrides:
// - catalog graph default API replaced to include OpenChoreo custom relations
// - catalog entity-presentation default API replaced to add custom kind icons
// - scaffolder `page:scaffolder` disabled (our legacy <ScaffolderPage> wins)
//   and form-decorators API replaced to inject the openChoreoTokenDecorator
// - customTranslationsModule reinstates the catalog-import header overrides
//   that previously rode via createApp.__experimentalTranslations
import {
  apiDocsPluginAlpha,
  catalogGraphPluginAlpha,
  catalogPluginAlpha,
  customAppModule,
  scaffolderPluginAlpha as upstreamScaffolderPluginAlpha,
  techdocsPluginAlpha,
} from './apis/customOverrides';

// catalog-import NFS plugin — registered so the `/catalog-import` route ref
// resolves under NFS. Our legacy `<RequirePermission><CustomCatalogImportPage /></...>`
// mount in `<FlatRoutes>` provides the actual page rendering.
import catalogImportPluginAlpha from '@backstage/plugin-catalog-import/alpha';
// api-docs and kubernetes NFS plugins — registered so that `apiDocsConfigRef`,
// `kubernetesApiRef`, etc. are present in the api holder. The host owns the
// `/api-docs` route (CustomApiExplorerPage) and the Kubernetes entity tab
// reuses upstream `EntityKubernetesContent`; without these features the apis
// they depend on are absent and the tabs throw `NotImplementedError`.
import kubernetesPluginAlpha from '@backstage/plugin-kubernetes/alpha';
// Community CI plugins — each ships an `/alpha` that contributes their
// entity-page tabs via `EntityContentBlueprint`. Registered so the Jenkins /
// GitHub Actions / GitLab tabs continue to show up on Component pages once
// the hand-authored `EntityPage.tsx` is gone. Each plugin filters itself by
// the relevant annotation.
//
// `apiDocsPluginAlpha` and `techdocsPluginAlpha` come from
// `./apis/customOverrides` instead of the raw upstream alphas — they extend
// the default filters with `hasApis(entity)` and `isTechDocsAvailable(entity)`
// so the "APIs" and "TechDocs" tabs are hidden when the entity doesn't
// support them (the pre-NFS `EntityPage.tsx` predicates, ported).
import jenkinsPluginAlpha from '@backstage-community/plugin-jenkins/alpha';
import githubActionsPluginAlpha from '@backstage-community/plugin-github-actions/alpha';
import gitlabPluginAlpha from '@immobiliarelabs/backstage-plugin-gitlab/alpha';
import { CatalogGraphPage } from '@backstage/plugin-catalog-graph';
import { RequirePermission } from '@backstage/plugin-permission-react';
import { catalogEntityCreatePermission } from '@backstage/plugin-catalog-common/alpha';
import { appThemes } from './themes';
import { LEGACY_KIND_ICONS } from './kindIcons';
import {
  AccessControlContent,
  PlatformAboutCard,
  SecretsContent,
  ExecTerminalWindowPage,
} from '@openchoreo/backstage-plugin';
import {
  UserSettingsPage,
  SettingsLayout,
  UserSettingsProfileCard,
  UserSettingsAppearanceCard,
  UserSettingsIdentityCard,
} from '@backstage/plugin-user-settings';
import { VisitListener } from '@backstage/plugin-home';

const legacyAppOptions = convertLegacyAppOptions({
  apis,
  icons: LEGACY_KIND_ICONS,
  themes: appThemes,
});

const routes = (
  <FlatRoutes>
    <Route path="/" element={<HomePage />} />
    {/*
      `/catalog` is owned by the NFS `page:catalog` extension and
      `/catalog/:namespace/:kind/:name` by `page:catalog/entity` — see
      customOverrides.tsx, which overrides each loader to render the
      host's `<CustomCatalogPage>` and the legacy `entityPage` JSX
      respectively. The legacy `<Route path="/catalog">` mount used to
      live here but double-rendered the catalog header under the NFS
      compat shim.
    */}
    <Route path="/docs" element={<TechDocsIndexPage />} />
    <Route
      path="/docs/:namespace/:kind/:name/*"
      element={<TechDocsReaderPage />}
    >
      <TechDocsAddons>
        <ReportIssue />
      </TechDocsAddons>
    </Route>
    {/*
      `/create` is owned by the NFS `page:scaffolder` extension — see
      customOverrides.tsx, which overrides its loader to render
      `<OpenChoreoScaffolderPage>` (the host's `<ScaffolderPage>` with
      the 27 field-extension children and `CustomTemplateListPage` /
      `CustomReviewStep` components). The legacy `<Route path="/create">`
      mount used to live here but double-rendered the scaffolder header
      under the NFS compat shim.
    */}
    <Route path="/api-docs" element={<CustomApiExplorerPage />} />
    <Route
      path="/catalog-import"
      element={
        <RequirePermission permission={catalogEntityCreatePermission}>
          <CustomCatalogImportPage />
        </RequirePermission>
      }
    />
    <Route path="/search" element={<SearchPage />}>
      {searchPage}
    </Route>
    <Route path="/settings" element={<UserSettingsPage />}>
      <SettingsLayout>
        <SettingsLayout.Route path="general" title="General">
          {/* The stock <UserSettingsGeneral /> grid, recomposed to append the
              OpenChoreo platform version card (openchoreo/openchoreo#4344). */}
          <Grid container direction="row" spacing={3}>
            <Grid item xs={12} md={6}>
              <UserSettingsProfileCard />
            </Grid>
            <Grid item xs={12} md={6}>
              <UserSettingsAppearanceCard />
            </Grid>
            <Grid item xs={12} md={6}>
              <UserSettingsIdentityCard />
            </Grid>
            <Grid item xs={12} md={6}>
              <PlatformAboutCard />
            </Grid>
          </Grid>
        </SettingsLayout.Route>
        <SettingsLayout.Route path="access-control" title="Access Control">
          <AccessControlContent />
        </SettingsLayout.Route>
        <SettingsLayout.Route path="secrets" title="Secrets">
          <SecretsContent />
        </SettingsLayout.Route>
      </SettingsLayout>
    </Route>
    <Route
      path="/catalog-graph"
      element={<CatalogGraphPage renderNode={CustomGraphNode} />}
    />
    <Route path="/platform-overview" element={<PlatformOverviewPage />} />
    <Route path="/cost-insights/*" element={<CostInsightsPage />} />
    <Route path="/delivery-insights" element={<DeliveryInsightsPage />} />
    {/*
      Standalone full-window exec terminal, opened in a new browser tab from the
      resource drawer. The page renders a fixed viewport overlay over the app
      chrome, so the terminal uses the entire window.
    */}
    <Route path="/exec-terminal" element={<ExecTerminalWindowPage />} />
  </FlatRoutes>
);

const legacyRoot = convertLegacyAppRoot(
  <>
    <AlertDisplay />
    <OAuthRequestDialog />
    <AppRouter>
      <VisitListener />
      <Root>{routes}</Root>
    </AppRouter>
  </>,
);

/** Options for {@link createPortalApp}. */
export interface PortalAppOptions {
  /**
   * Additional frontend features (plugins/modules) appended after the
   * portal's own. Use this to add your plugins to a custom portal.
   */
  features?: FrontendFeature[];
}

/**
 * Assembles the OpenChoreo Portal frontend app. The stock portal renders
 * `createPortalApp().createRoot()`; a custom portal can pass extra features.
 */
export function createPortalApp(options?: PortalAppOptions) {
  return createApp({
    features: [
      // `...legacyRoot` re-emits each legacy plugin's `apis: [...]` array as
      // ApiBlueprint extensions under the legacy plugin's own pluginId
      // (collectLegacyRoutes). The NFS api-factory registry resolves
      // same-pluginId factories last-write-wins, so the override features
      // below MUST come after `...legacyRoot` to win the contest. Otherwise
      // our custom catalog-graph relations, entity-presentation kind icons,
      // and scaffolder form-decorator override get silently overwritten by
      // upstream defaults at startup.
      legacyAppOptions,
      ...legacyRoot,
      customAppModule,
      upstreamScaffolderPluginAlpha,
      catalogGraphPluginAlpha,
      catalogPluginAlpha,
      catalogImportPluginAlpha,
      apiDocsPluginAlpha,
      kubernetesPluginAlpha,
      techdocsPluginAlpha,
      jenkinsPluginAlpha,
      githubActionsPluginAlpha,
      gitlabPluginAlpha,
      // `openchoreoCiPluginAlpha` is registered BEFORE `openchoreoPluginAlpha`
      // so that within the `deployment` tab group the "Build" tab (contributed
      // by CI) shows before "Deploy" (contributed by the base plugin) — matching
      // the pre-NFS `EntityPage.tsx` order. Tab ordering by group is handled by
      // `openChoreoEntityPageOverride`'s sort; ties within a group fall back to
      // registration order, which this line controls.
      openchoreoCiPluginAlpha,
      openchoreoPluginAlpha,
      openchoreoObservabilityPluginAlpha,
      openchoreoWorkflowsPluginAlpha,
      platformEngineerCorePluginAlpha,
      // Overrides the canonical `page:catalog/entity` loader to mount
      // `OpenChoreoEntityLayout` (compact header + styled tab bar + delete /
      // annotation menu items). Ships from `@openchoreo/backstage-plugin/alpha`
      // so external adopters can opt in the same way.
      openChoreoEntityPageOverride,
      ...(options?.features ?? []),
    ],
    bindRoutes({ bind }) {
      bind(catalogPlugin.externalRoutes, {
        createComponent: scaffolderPlugin.routes.root,
        viewTechDoc: techdocsPlugin.routes.docRoot,
        createFromTemplate: scaffolderPlugin.routes.selectedTemplate,
      });
      bind(scaffolderPlugin.externalRoutes, {
        registerComponent: catalogImportPlugin.routes.importPage,
        viewTechDoc: techdocsPlugin.routes.docRoot,
      });
    },
    advanced: {
      // App-boot loader (waiting for config/features) — use our centered loader
      // instead of the default Backstage progress bar.
      loadingElement: <PageLoader />,
    },
  });
}
