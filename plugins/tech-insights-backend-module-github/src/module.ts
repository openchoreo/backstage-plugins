import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { techInsightsFactRetrieversExtensionPoint } from '@backstage-community/plugin-tech-insights-node';
import {
  createGithubRepositoryFactRetriever,
  GITHUB_REPOSITORY_FACT_RETRIEVER_ID,
} from './githubRepositoryFactRetriever';
import {
  createGithubCodeScanningFactRetriever,
  GITHUB_CODE_SCANNING_FACT_RETRIEVER_ID,
} from './githubCodeScanningFactRetriever';
import { readCodeScanningOptions } from './options';

export const techInsightsModuleGithub = createBackendModule({
  pluginId: 'tech-insights',
  moduleId: 'github',
  register(reg) {
    reg.registerInit({
      deps: {
        factRetrievers: techInsightsFactRetrieversExtensionPoint,
        cache: coreServices.cache,
        config: coreServices.rootConfig,
      },
      async init({ factRetrievers, cache, config }) {
        factRetrievers.addFactRetrievers({
          [GITHUB_REPOSITORY_FACT_RETRIEVER_ID]:
            createGithubRepositoryFactRetriever({ cache }),
          [GITHUB_CODE_SCANNING_FACT_RETRIEVER_ID]:
            createGithubCodeScanningFactRetriever({
              cache,
              options: readCodeScanningOptions(config),
            }),
        });
      },
    });
  },
});
