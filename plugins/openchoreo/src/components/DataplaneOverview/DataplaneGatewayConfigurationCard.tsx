import { useEntity } from '@backstage/plugin-catalog-react';
import { GatewayConfigurationCard } from '../GatewayConfigurationCard';

export const DataplaneGatewayConfigurationCard = () => {
  const { entity } = useEntity();
  const spec = entity.spec as any;
  return <GatewayConfigurationCard gateway={spec?.gateway} />;
};
