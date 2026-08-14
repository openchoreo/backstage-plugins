import type { EntityContentLayoutProps } from '@backstage/plugin-catalog-react/alpha';
import { RELATION_PART_OF, RELATION_HAS_PART } from '@backstage/catalog-model';
import {
  RELATION_USES_WORKFLOW,
  RELATION_WORKFLOW_USED_BY,
} from '@openchoreo/backstage-plugin-common';
import { ComponentWorkflowOverviewCard } from '../../components/ComponentWorkflowOverview';
import { TypeFamilyOverviewLayout } from './TypeFamilyOverviewLayout';

export default function ComponentWorkflowOverviewLayout(
  props: EntityContentLayoutProps,
) {
  return (
    <TypeFamilyOverviewLayout
      OverviewCard={ComponentWorkflowOverviewCard}
      graphProps={{
        relations: [
          RELATION_PART_OF,
          RELATION_HAS_PART,
          RELATION_USES_WORKFLOW,
          RELATION_WORKFLOW_USED_BY,
        ],
      }}
      cards={props.cards}
    />
  );
}
