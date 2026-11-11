import {
  DeploymentsSummaryCard,
  type LoadDeploymentEnvironments,
} from '../DeploymentsSummaryCard';

const loadResourceEnvironments: LoadDeploymentEnvironments = (client, entity) =>
  client.fetchResourceEnvironmentInfo(entity);

export const ResourceDeploymentsCard = () => (
  <DeploymentsSummaryCard loadEnvironments={loadResourceEnvironments} />
);
