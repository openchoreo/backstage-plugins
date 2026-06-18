import { Route } from 'react-router-dom';
import { CatalogIndexPage, catalogPlugin } from '@backstage/plugin-catalog';
import {
  CatalogImportPage,
  catalogImportPlugin,
} from '@backstage/plugin-catalog-import';
import { ScaffolderPage, scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { ScaffolderFieldExtensions } from '@backstage/plugin-scaffolder-react';
import { ComponentNamePickerFieldExtension } from './scaffolder/ComponentNamePicker';
import { ResourceNamePickerFieldExtension } from './scaffolder/ResourceNamePicker';
import { BuildTemplatePickerFieldExtension } from './scaffolder/BuildTemplatePicker';
import { BuildTemplateParametersFieldExtension } from './scaffolder/BuildTemplateParameters';
import { BuildWorkflowPickerFieldExtension } from './scaffolder/BuildWorkflowPicker';
import { BuildWorkflowParametersFieldExtension } from './scaffolder/BuildWorkflowParameters';
import { TraitsFieldExtension } from './scaffolder/TraitsField';
import { SwitchFieldExtension } from './scaffolder/SwitchField';
import { AdvancedConfigurationFieldExtension } from './scaffolder/AdvancedConfigurationField';
import { DeploymentSourcePickerFieldExtension } from './scaffolder/DeploymentSourcePicker';
import { BuildAndDeployFieldExtension } from './scaffolder/BuildAndDeployField';
import { ContainerImageFieldExtension } from './scaffolder/ContainerImageField';
import { ComponentTypeYamlEditorFieldExtension } from './scaffolder/ComponentTypeYamlEditor';
import { TraitYamlEditorFieldExtension } from './scaffolder/TraitYamlEditor';
import { ClusterComponentTypeYamlEditorFieldExtension } from './scaffolder/ClusterComponentTypeYamlEditor';
import { ClusterResourceTypeYamlEditorFieldExtension } from './scaffolder/ClusterResourceTypeYamlEditor';
import { ResourceTypeYamlEditorFieldExtension } from './scaffolder/ResourceTypeYamlEditor';
import { ResourceParametersFieldExtension } from './scaffolder/ResourceParametersField';
import { ClusterTraitYamlEditorFieldExtension } from './scaffolder/ClusterTraitYamlEditor';
import { ComponentWorkflowYamlEditorFieldExtension } from './scaffolder/ComponentWorkflowYamlEditor';
import { ClusterWorkflowYamlEditorFieldExtension } from './scaffolder/ClusterWorkflowYamlEditor';
import { GitSourceFieldExtension } from './scaffolder/GitSourceField';
import { ProjectNamespaceFieldExtension } from './scaffolder/ProjectNamespaceField';
import { NamespaceEntityPickerFieldExtension } from './scaffolder/NamespaceEntityPicker';
import { DeploymentPipelinePickerFieldExtension } from './scaffolder/DeploymentPipelinePicker';
import { EnvironmentFormWithYamlFieldExtension } from './scaffolder/EnvironmentFormWithYaml';
import { DeploymentPipelineFormWithYamlFieldExtension } from './scaffolder/DeploymentPipelineFormWithYaml';
import { WorkloadDetailsFieldExtension } from './scaffolder/WorkloadDetailsField';
import { CustomTemplateListPage } from './components/scaffolder/CustomTemplateListPage';
import { CustomReviewStep } from './scaffolder/CustomReviewState';
import { SearchPage } from '@backstage/plugin-search';
import {
  TechDocsIndexPage,
  techdocsPlugin,
  TechDocsReaderPage,
} from '@backstage/plugin-techdocs';
import { TechDocsAddons } from '@backstage/plugin-techdocs-react';
import { ReportIssue } from '@backstage/plugin-techdocs-module-addons-contrib';
import { apis } from './apis';
import { CustomCatalogPage } from './components/catalog/CustomCatalogPage';
import { CustomApiExplorerPage } from './components/catalog/CustomApiExplorerPage';
import { searchPage } from './components/search/SearchPage';
import { Root } from './components/Root';
import { HomePage } from './components/Home';
import { CustomGraphNode } from '@openchoreo/backstage-plugin-react';
import { PlatformOverviewPage } from './components/platformOverview';

import { AlertDisplay, OAuthRequestDialog } from '@backstage/core-components';
import { createApp } from '@backstage/frontend-defaults';
import {
  convertLegacyAppOptions,
  convertLegacyAppRoot,
} from '@backstage/core-compat-api';
import { AppRouter, FlatRoutes } from '@backstage/core-app-api';

// NFS plugin features (created in Step 2 — each plugin's `/alpha` exports a
// `createFrontendPlugin` instance). These replace the API factory entries
// that previously lived in `apis.ts`.
import openchoreoPluginAlpha from '@openchoreo/backstage-plugin/alpha';
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
  catalogGraphPluginAlpha,
  catalogPluginAlpha,
  customAppModule,
  scaffolderPluginAlpha as upstreamScaffolderPluginAlpha,
} from './apis/customOverrides';

// catalog-import NFS plugin — registered so the `/catalog-import` route ref
// resolves under NFS. Our legacy `<RequirePermission><CatalogImportPage /></...>`
// mount in `<FlatRoutes>` provides the actual page rendering.
import catalogImportPluginAlpha from '@backstage/plugin-catalog-import/alpha';
// api-docs and kubernetes NFS plugins — registered so that `apiDocsConfigRef`,
// `kubernetesApiRef`, etc. are present in the api holder. The host owns the
// `/api-docs` route (CustomApiExplorerPage) and the Kubernetes entity tab
// reuses upstream `EntityKubernetesContent`; without these features the apis
// they depend on are absent and the tabs throw `NotImplementedError`.
import apiDocsPluginAlpha from '@backstage/plugin-api-docs/alpha';
import kubernetesPluginAlpha from '@backstage/plugin-kubernetes/alpha';
import { CatalogGraphPage } from '@backstage/plugin-catalog-graph';
import { RequirePermission } from '@backstage/plugin-permission-react';
import { catalogEntityCreatePermission } from '@backstage/plugin-catalog-common/alpha';
import { appThemes } from './themes';
import { LEGACY_KIND_ICONS } from './kindIcons';
import {
  AccessControlContent,
  SecretsContent,
} from '@openchoreo/backstage-plugin';
import {
  UserSettingsPage,
  SettingsLayout,
  UserSettingsGeneral,
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
    <Route path="/catalog" element={<CatalogIndexPage />}>
      <CustomCatalogPage initialKind="system" />
    </Route>
    {/*
      The entity route (`/catalog/:namespace/:kind/:name`) is owned by the
      NFS `page:catalog/entity` extension — see customOverrides.tsx where
      we override its loader to wrap the legacy `entityPage` JSX in
      `OpenChoreoCatalogEntityPage` so the custom header, tab styles, and
      hand-authored per-kind Overview layouts are preserved.
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
    <Route
      path="/create"
      element={
        <ScaffolderPage
          headerOptions={{
            title: 'Create a new resource',
            subtitle:
              'Create new resources using standard templates in your organization',
          }}
          components={{
            EXPERIMENTAL_TemplateListPageComponent: CustomTemplateListPage,
            ReviewStepComponent: CustomReviewStep,
          }}
        />
      }
    >
      <ScaffolderFieldExtensions>
        <ComponentNamePickerFieldExtension />
        <ResourceNamePickerFieldExtension />
        <ProjectNamespaceFieldExtension />
        <NamespaceEntityPickerFieldExtension />
        <DeploymentPipelinePickerFieldExtension />
        <BuildTemplatePickerFieldExtension />
        <BuildTemplateParametersFieldExtension />
        <BuildWorkflowPickerFieldExtension />
        <BuildWorkflowParametersFieldExtension />
        <TraitsFieldExtension />
        <SwitchFieldExtension />
        <AdvancedConfigurationFieldExtension />
        <DeploymentSourcePickerFieldExtension />
        <BuildAndDeployFieldExtension />
        <ContainerImageFieldExtension />
        <ComponentTypeYamlEditorFieldExtension />
        <TraitYamlEditorFieldExtension />
        <ClusterComponentTypeYamlEditorFieldExtension />
        <ClusterResourceTypeYamlEditorFieldExtension />
        <ResourceTypeYamlEditorFieldExtension />
        <ResourceParametersFieldExtension />
        <ClusterTraitYamlEditorFieldExtension />
        <ComponentWorkflowYamlEditorFieldExtension />
        <ClusterWorkflowYamlEditorFieldExtension />
        <EnvironmentFormWithYamlFieldExtension />
        <DeploymentPipelineFormWithYamlFieldExtension />
        <GitSourceFieldExtension />
        <WorkloadDetailsFieldExtension />
      </ScaffolderFieldExtensions>
    </Route>
    <Route path="/api-docs" element={<CustomApiExplorerPage />} />
    <Route
      path="/catalog-import"
      element={
        <RequirePermission permission={catalogEntityCreatePermission}>
          <CatalogImportPage />
        </RequirePermission>
      }
    />
    <Route path="/search" element={<SearchPage />}>
      {searchPage}
    </Route>
    <Route path="/settings" element={<UserSettingsPage />}>
      <SettingsLayout>
        <SettingsLayout.Route path="general" title="General">
          <UserSettingsGeneral />
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

const app = createApp({
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
    openchoreoPluginAlpha,
    openchoreoCiPluginAlpha,
    openchoreoObservabilityPluginAlpha,
    openchoreoWorkflowsPluginAlpha,
    platformEngineerCorePluginAlpha,
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
});

export default app.createRoot();
