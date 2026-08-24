import type { EntityContentLayoutProps } from '@backstage/plugin-catalog-react/alpha';
import { ProjectTypeOverviewCard } from '../../components/ProjectTypeOverview';
import { TypeFamilyOverviewLayout } from './TypeFamilyOverviewLayout';

export default function ProjectTypeOverviewLayout(
  props: EntityContentLayoutProps,
) {
  return (
    <TypeFamilyOverviewLayout
      OverviewCard={ProjectTypeOverviewCard}
      cards={props.cards}
    />
  );
}
