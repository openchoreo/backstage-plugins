import type { EntityContentLayoutProps } from '@backstage/plugin-catalog-react/alpha';
import { TraitTypeOverviewCard } from '../../components/TraitTypeOverview';
import { TypeFamilyOverviewLayout } from './TypeFamilyOverviewLayout';

export default function TraitTypeOverviewLayout(
  props: EntityContentLayoutProps,
) {
  return (
    <TypeFamilyOverviewLayout
      OverviewCard={TraitTypeOverviewCard}
      cards={props.cards}
    />
  );
}
