import { Entity } from '@backstage/catalog-model/index';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useMemo } from 'react';

const ConditionalEntityWrapper = ({
  children,
  activationFn,
}: {
  children: React.ReactNode;
  activationFn: (entity: Entity) => boolean;
}) => {
  const { entity } = useEntity();
  const isActive = useMemo(() => activationFn(entity), [entity, activationFn]);
  return isActive ? children : null;
};

export default ConditionalEntityWrapper;
