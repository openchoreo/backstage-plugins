import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { techInsightsFactRetrieversExtensionPoint } from '@backstage-community/plugin-tech-insights-node';
import {
  createGithubRepositoryFactRetriever,
  GITHUB_REPOSITORY_FACT_RETRIEVER_ID,
} from './githubRepositoryFactRetriever';

export const techInsightsModuleGithub = createBackendModule({
  pluginId: 'tech-insights',
  moduleId: 'github',
  register(reg) {
    reg.registerInit({
      deps: {
        factRetrievers: techInsightsFactRetrieversExtensionPoint,
        cache: coreServices.cache,
      },
      async init({ factRetrievers, cache }) {
        factRetrievers.addFactRetrievers({
          [GITHUB_REPOSITORY_FACT_RETRIEVER_ID]:
            createGithubRepositoryFactRetriever({ cache }),
        });
      },
    });
  },
});
