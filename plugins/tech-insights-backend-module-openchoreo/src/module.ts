import { createBackendModule } from '@backstage/backend-plugin-api';
import { techInsightsFactRetrieversExtensionPoint } from '@backstage-community/plugin-tech-insights-node';
import { openChoreoTokenServiceRef } from '@openchoreo/openchoreo-auth';
import {
  createOpenChoreoComponentTypeFactRetriever,
  OPENCHOREO_COMPONENT_TYPE_FACT_RETRIEVER_ID,
} from './openchoreoComponentTypeFactRetriever';
import {
  createOpenChoreoDeploymentFactRetriever,
  OPENCHOREO_DEPLOYMENT_FACT_RETRIEVER_ID,
} from './openchoreoDeploymentFactRetriever';

export const techInsightsModuleOpenChoreo = createBackendModule({
  pluginId: 'tech-insights',
  moduleId: 'openchoreo',
  register(reg) {
    reg.registerInit({
      deps: {
        factRetrievers: techInsightsFactRetrieversExtensionPoint,
        tokenService: openChoreoTokenServiceRef,
      },
      async init({ factRetrievers, tokenService }) {
        factRetrievers.addFactRetrievers({
          [OPENCHOREO_COMPONENT_TYPE_FACT_RETRIEVER_ID]:
            createOpenChoreoComponentTypeFactRetriever(tokenService),
          [OPENCHOREO_DEPLOYMENT_FACT_RETRIEVER_ID]:
            createOpenChoreoDeploymentFactRetriever(tokenService),
        });
      },
    });
  },
});
