import { catalogPlugin } from '@backstage/plugin-catalog';
import { catalogImportPlugin } from '@backstage/plugin-catalog-import';
import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { techdocsPlugin } from '@backstage/plugin-techdocs';
import { techDocsReportIssueAddonModule } from '@backstage/plugin-techdocs-module-addons-contrib/alpha';
import { PageLoader } from '@openchoreo/backstage-design-system';

import { createApp } from '@backstage/frontend-defaults';
import type { FrontendFeature } from '@backstage/frontend-plugin-api';
import { appModule } from './appModule';

import openchoreoPluginAlpha, {
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
import { portalAppPlugin } from './portalPlugin';

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
      // APIs first so overrides below win via last-write-wins.
      appModule,
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
      // `openchoreoCiPluginAlpha` before `openchoreoPluginAlpha` so within
      // the `deployment` tab group Build (CI) shows before Deploy (base).
      openchoreoCiPluginAlpha,
      openchoreoPluginAlpha,
      openchoreoObservabilityPluginAlpha,
      openchoreoWorkflowsPluginAlpha,
      platformEngineerCorePluginAlpha,
      portalAppPlugin,
      // Mounts OpenChoreoEntityLayout as the page:catalog/entity chrome.
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
      loadingElement: <PageLoader />,
    },
  });
}
