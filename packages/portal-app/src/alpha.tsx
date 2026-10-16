/**
 * Frontend-discovery entry point for the OpenChoreo Portal shell.
 *
 * The default export is a feature loader carrying every feature the portal is
 * made of, in a load-bearing order (see `portalFeatures`). Because it is the
 * *default* export of an entry point on a package whose `backstage.role` is
 * `frontend-plugin-module`, Backstage's frontend feature discovery picks the
 * whole shell up from the dependency alone — an app package needs no `features`
 * array, only `app.packages` in its config.
 *
 * A loader rather than a flat module list for two reasons. It is the only shape
 * discovery can consume (one package contributes one default export, and the
 * portal is ~24 features), and it keeps the composition *order* ours: a loader's
 * features are spliced in at the loader's position, in the order it returns
 * them, so the three ordering constraints below survive discovery intact.
 *
 * @packageDocumentation
 */

import { createFrontendFeatureLoader } from '@backstage/frontend-plugin-api';
import type {
  FrontendFeature,
  FrontendFeatureLoader,
} from '@backstage/frontend-plugin-api';

import { appModule } from './appModule';
import { portalAppPlugin } from './portalPlugin';
import { homeModule } from './components/Home';

import { techDocsReportIssueAddonModule } from '@backstage/plugin-techdocs-module-addons-contrib/alpha';
import openchoreoPluginAlpha, {
  openChoreoAppModule,
  openChoreoEntityPageOverride,
} from '@openchoreo/backstage-plugin/alpha';
import openchoreoCiPluginAlpha from '@openchoreo/backstage-plugin-openchoreo-ci/alpha';
import openchoreoObservabilityPluginAlpha from '@openchoreo/backstage-plugin-openchoreo-observability/alpha';
import openchoreoWorkflowsPluginAlpha from '@openchoreo/backstage-plugin-openchoreo-workflows/alpha';
import platformEngineerCorePluginAlpha from '@openchoreo/backstage-plugin-platform-engineer-core/alpha';

import {
  apiDocsPluginAlpha,
  catalogGraphPluginAlpha,
  catalogImportPluginAlpha,
  catalogPluginAlpha,
  customAppModule,
  scaffolderPluginAlpha as upstreamScaffolderPluginAlpha,
  searchPluginAlpha,
  techdocsPluginAlpha,
  userSettingsPluginAlpha,
} from './apis/customOverrides';

import kubernetesPluginAlpha from '@backstage/plugin-kubernetes/alpha';
import jenkinsPluginAlpha from '@backstage-community/plugin-jenkins/alpha';
import githubActionsPluginAlpha from '@backstage-community/plugin-github-actions/alpha';
import gitlabPluginAlpha from '@immobiliarelabs/backstage-plugin-gitlab/alpha';
import homePluginAlpha from '@backstage/plugin-home/alpha';

/**
 * Every feature the OpenChoreo Portal is composed of, in registration order.
 *
 * The order is load-bearing in three places, each asserted by `alpha.test.ts`
 * so a future reshuffle fails a test rather than a page:
 *
 * 1. API-carrying modules come first, so the plugin-scoped `withOverrides`
 *    further down win by last-write-wins.
 * 2. `openchoreoCiPluginAlpha` before `openchoreoPluginAlpha`, so Build (CI)
 *    shows before Deploy (base) inside the `deployment` tab group.
 * 3. `platformEngineerCorePluginAlpha` before `openchoreoObservabilityPluginAlpha`,
 *    so the Platform section's Overview tab is collected before the Logs tab —
 *    it is also where `/platform-overview` redirects to. `app-config.yaml` pins
 *    this pair explicitly under `app.extensions` as well, which is what makes it
 *    safe for a host to reorder.
 */
export const portalFeatures: (FrontendFeature | FrontendFeatureLoader)[] = [
  // APIs first so overrides below win via last-write-wins.
  appModule,
  // Ships OC fetch/permission overrides on pluginId 'app' so they
  // replace Backstage's default core.fetch / plugin.permission.api.
  //
  // Not redundant with `openchoreoPluginAlpha` below, which is a loader that
  // yields this same module: resolution does not de-duplicate, and the app
  // de-duplicates on *first* insertion — so this explicit early slot is what
  // keeps these overrides ahead of the `withOverrides` plugins that follow.
  // Dropping it moves them to the bottom of the list. Pinned by alpha.test.ts.
  openChoreoAppModule,
  customAppModule,
  upstreamScaffolderPluginAlpha,
  catalogGraphPluginAlpha,
  catalogPluginAlpha,
  catalogImportPluginAlpha,
  apiDocsPluginAlpha,
  kubernetesPluginAlpha,
  techdocsPluginAlpha,
  searchPluginAlpha,
  jenkinsPluginAlpha,
  githubActionsPluginAlpha,
  gitlabPluginAlpha,
  userSettingsPluginAlpha,
  techDocsReportIssueAddonModule,
  // Constraint 2 — see above.
  openchoreoCiPluginAlpha,
  openchoreoPluginAlpha,
  // Constraint 3 — see above.
  platformEngineerCorePluginAlpha,
  openchoreoObservabilityPluginAlpha,
  openchoreoWorkflowsPluginAlpha,
  // Home plugin provides `page:home`; our module contributes the custom
  // layout and widgets, and app-config points `page:home` at `/`.
  homePluginAlpha,
  homeModule,
  portalAppPlugin,
  // Mounts OpenChoreoEntityLayout as the page:catalog/entity chrome.
  openChoreoEntityPageOverride,
];

/**
 * The whole OpenChoreo Portal shell as a single discoverable feature.
 *
 * `openchoreoPluginAlpha` is itself a feature loader, so this nests one level —
 * well inside Backstage's recursion limit of 5.
 */
export default createFrontendFeatureLoader({
  loader: () => portalFeatures,
});
