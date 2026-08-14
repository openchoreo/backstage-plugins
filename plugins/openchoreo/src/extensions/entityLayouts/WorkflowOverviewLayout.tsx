import type { EntityContentLayoutProps } from '@backstage/plugin-catalog-react/alpha';
import { WorkflowOverviewCard } from '../../components/WorkflowOverview';
import { TypeFamilyOverviewLayout } from './TypeFamilyOverviewLayout';

export default function WorkflowOverviewLayout(
  props: EntityContentLayoutProps,
) {
  return (
    <TypeFamilyOverviewLayout
      OverviewCard={WorkflowOverviewCard}
      cards={props.cards}
    />
  );
}
