import type { EntityContentLayoutProps } from '@backstage/plugin-catalog-react/alpha';
import { ComponentTypeOverviewCard } from '../../components/ComponentTypeOverview';
import { TypeFamilyOverviewLayout } from './TypeFamilyOverviewLayout';

export default function ComponentTypeOverviewLayout(
  props: EntityContentLayoutProps,
) {
  return (
    <TypeFamilyOverviewLayout
      OverviewCard={ComponentTypeOverviewCard}
      cards={props.cards}
    />
  );
}
