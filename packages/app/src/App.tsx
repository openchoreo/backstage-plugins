import { Route } from 'react-router-dom';
import { apiDocsPlugin, ApiExplorerPage } from '@backstage/plugin-api-docs';
import {
  CatalogEntityPage,
  CatalogIndexPage,
  catalogPlugin,
} from '@backstage/plugin-catalog';
import {
  CatalogImportPage,
  catalogImportPlugin,
} from '@backstage/plugin-catalog-import';
import { ScaffolderPage, scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { ScaffolderFieldExtensions } from '@backstage/plugin-scaffolder-react';
import { ComponentNamePickerFieldExtension } from './scaffolder/ComponentNamePicker';
import { BuildTemplatePickerFieldExtension } from './scaffolder/BuildTemplatePicker';
import { BuildTemplateParametersFieldExtension } from './scaffolder/BuildTemplateParameters';
import { BuildWorkflowPickerFieldExtension } from './scaffolder/BuildWorkflowPicker';
import { BuildWorkflowParametersFieldExtension } from './scaffolder/BuildWorkflowParameters';
import { TraitsFieldExtension } from './scaffolder/TraitsField';
import { SwitchFieldExtension } from './scaffolder/SwitchField';
import { AdvancedConfigurationFieldExtension } from './scaffolder/AdvancedConfigurationField';
import { DeploymentSourcePickerFieldExtension } from './scaffolder/DeploymentSourcePicker';
import { ContainerImageFieldExtension } from './scaffolder/ContainerImageField';
import { ProjectNamespaceFieldExtension } from './scaffolder/ProjectNamespaceField';
import { CustomReviewStep } from './scaffolder/CustomReviewState';
import { orgPlugin } from '@backstage/plugin-org';
import { SearchPage } from '@backstage/plugin-search';
import {
  TechDocsIndexPage,
  techdocsPlugin,
  TechDocsReaderPage,
} from '@backstage/plugin-techdocs';
import { TechDocsAddons } from '@backstage/plugin-techdocs-react';
import { ReportIssue } from '@backstage/plugin-techdocs-module-addons-contrib';
import { UserSettingsPage } from '@backstage/plugin-user-settings';
import { apis, openChoreoAuthApiRef } from './apis';
import { entityPage } from './components/catalog/EntityPage';
import { CustomCatalogPage } from './components/catalog/CustomCatalogPage';
import { searchPage } from './components/search/SearchPage';
import { Root } from './components/Root';
import { HomePage } from './components/Home';
import { CustomGraphNode } from './components/catalog/CustomGraphNode';

import {
  AlertDisplay,
  OAuthRequestDialog,
  SignInPage,
} from '@backstage/core-components';
import { createApp } from '@backstage/app-defaults';
import { AppRouter, FlatRoutes } from '@backstage/core-app-api';
import { CatalogGraphPage } from '@backstage/plugin-catalog-graph';
import { RequirePermission } from '@backstage/plugin-permission-react';
import { catalogEntityCreatePermission } from '@backstage/plugin-catalog-common/alpha';
import {
  OpenChoreoIcon,
  openChoreoTheme,
} from '@openchoreo/backstage-design-system';
import CloudIcon from '@material-ui/icons/Cloud';
import DnsIcon from '@material-ui/icons/Dns';
import AccountTreeIcon from '@material-ui/icons/AccountTree';
import VisibilityIcon from '@material-ui/icons/Visibility';
import BuildIcon from '@material-ui/icons/Build';
import { AccessControlPage, GitSecretsPage } from '@openchoreo/backstage-plugin';
import CategoryIcon from '@material-ui/icons/Category';
import ExtensionIcon from '@material-ui/icons/Extension';
import PlayCircleOutlineIcon from '@material-ui/icons/PlayCircleOutline';
import SettingsApplicationsIcon from '@material-ui/icons/SettingsApplications';
import { UnifiedThemeProvider } from '@backstage/theme';
import { VisitListener } from '@backstage/plugin-home';
import { configApiRef, useApi } from '@backstage/core-plugin-api';
import { OpenChoreoProviderSettings } from './components/settings/OpenChoreoProviderSettings';

/**
 * Dynamic SignInPage that switches between OAuth and Guest mode
 * based on openchoreo.features.auth.enabled configuration.
 *
 * When auth is enabled (default): Uses OpenChoreo IDP OAuth flow
 * When auth is disabled: Auto-signs in as guest user using Backstage's built-in guest provider
 */
function DynamicSignInPage(props: any) {
  const configApi = useApi(configApiRef);

  // Check if auth feature is enabled (defaults to true)
  const authEnabled =
    configApi.getOptionalBoolean('openchoreo.features.auth.enabled') ?? true;

  if (!authEnabled) {
    // Guest mode: use Backstage's built-in guest provider
    // This uses ProxiedSignInIdentity with the backend guest module
    // and falls back to GuestUserIdentity (legacy) if not available
    return <SignInPage {...props} auto providers={['guest']} />;
  }

  // Default: OpenChoreo Auth (works with any OIDC-compliant IDP)
  return (
    <SignInPage
      {...props}
      auto
      provider={{
        id: 'openchoreo-auth',
        title: 'OpenChoreo',
        message: 'Sign in using OpenChoreo',
        apiRef: openChoreoAuthApiRef,
      }}
    />
  );
}

const app = createApp({
  apis,
  icons: {
    'kind:environment': CloudIcon,
    'kind:dataplane': DnsIcon,
    'kind:deploymentpipeline': AccountTreeIcon,
    'kind:observabilityplane': VisibilityIcon,
    'kind:buildplane': BuildIcon,
    'kind:componenttype': CategoryIcon,
    'kind:traittype': ExtensionIcon,
    'kind:workflow': PlayCircleOutlineIcon,
    'kind:componentworkflow': SettingsApplicationsIcon,
  },
  bindRoutes({ bind }) {
    bind(catalogPlugin.externalRoutes, {
      createComponent: scaffolderPlugin.routes.root,
      viewTechDoc: techdocsPlugin.routes.docRoot,
      createFromTemplate: scaffolderPlugin.routes.selectedTemplate,
    });
    bind(apiDocsPlugin.externalRoutes, {
      registerApi: catalogImportPlugin.routes.importPage,
    });
    bind(scaffolderPlugin.externalRoutes, {
      registerComponent: catalogImportPlugin.routes.importPage,
      viewTechDoc: techdocsPlugin.routes.docRoot,
    });
    bind(orgPlugin.externalRoutes, {
      catalogIndex: catalogPlugin.routes.catalogIndex,
    });
  },
  components: {
    SignInPage: DynamicSignInPage,
  },
  themes: [
    {
      id: 'openchoreo-theme',
      title: 'OpenChoreo Theme',
      variant: 'dark',
      icon: <OpenChoreoIcon />,
      Provider: ({ children }) => (
        <UnifiedThemeProvider theme={openChoreoTheme} children={children} />
      ),
    },
  ],
});

const templateGroups = [
  {
    title: 'Component Templates',
    filter: (entity: any) => entity.spec?.type === 'Component Type',
  },
  {
    title: 'Other Templates',
    filter: (entity: any) => entity.spec?.type !== 'Component Type',
  },
];

const routes = (
  <FlatRoutes>
    <Route path="/" element={<HomePage />} />
    <Route path="/catalog" element={<CatalogIndexPage />}>
      <CustomCatalogPage
        initialKind="component"
        initiallySelectedFilter="all"
        ownerPickerMode="all"
      />
    </Route>
    <Route
      path="/catalog/:namespace/:kind/:name"
      element={<CatalogEntityPage />}
    >
      {entityPage}
    </Route>
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
          groups={templateGroups}
          components={{
            ReviewStepComponent: CustomReviewStep,
          }}
        />
      }
    >
      <ScaffolderFieldExtensions>
        <ComponentNamePickerFieldExtension />
        <ProjectNamespaceFieldExtension />
        <BuildTemplatePickerFieldExtension />
        <BuildTemplateParametersFieldExtension />
        <BuildWorkflowPickerFieldExtension />
        <BuildWorkflowParametersFieldExtension />
        <TraitsFieldExtension />
        <SwitchFieldExtension />
        <AdvancedConfigurationFieldExtension />
        <DeploymentSourcePickerFieldExtension />
        <ContainerImageFieldExtension />
      </ScaffolderFieldExtensions>
    </Route>
    <Route path="/api-docs" element={<ApiExplorerPage />} />
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
    <Route
      path="/settings"
      element={
        <UserSettingsPage providerSettings={<OpenChoreoProviderSettings />} />
      }
    />
    <Route
      path="/catalog-graph"
      element={<CatalogGraphPage renderNode={CustomGraphNode} />}
    />
    <Route path="/admin/access-control" element={<AccessControlPage />} />
    <Route path="/admin/git-secrets" element={<GitSecretsPage />} />
  </FlatRoutes>
);

export default app.createRoot(
  <>
    <AlertDisplay />
    <OAuthRequestDialog />
    <AppRouter>
      <VisitListener />
      <Root>{routes}</Root>
    </AppRouter>
  </>,
);
