import {
  DeploymentsSummaryCard,
  type LoadDeploymentEnvironments,
} from '../DeploymentsSummaryCard';

const loadEndpointEnvironments: LoadDeploymentEnvironments = (client, entity) =>
  client.fetchEndpointEnvironmentInfo(entity);

export const EndpointDeploymentsCard = () => (
  <DeploymentsSummaryCard loadEnvironments={loadEndpointEnvironments} />
);
