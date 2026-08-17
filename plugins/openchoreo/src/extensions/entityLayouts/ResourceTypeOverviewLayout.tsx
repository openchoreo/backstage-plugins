import type { EntityContentLayoutProps } from '@backstage/plugin-catalog-react/alpha';
import { ResourceTypeOverviewCard } from '../../components/ResourceTypeOverview';
import { TypeFamilyOverviewLayout } from './TypeFamilyOverviewLayout';

export default function ResourceTypeOverviewLayout(
  props: EntityContentLayoutProps,
) {
  return (
    <TypeFamilyOverviewLayout
      OverviewCard={ResourceTypeOverviewCard}
      cards={props.cards}
    />
  );
}
