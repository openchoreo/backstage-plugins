import type { Entity } from '@backstage/catalog-model';
import { useEntityScorecard } from '../../hooks';
import { TierChip } from '../TierChip';

export interface EntityScorecardRankChipProps {
  entity: Entity;
}

/**
 * An entity's tier as a chip, for entity headers and overview cards.
 * Renders nothing while loading or when no checks apply.
 */
export function EntityScorecardRankChip({
  entity,
}: EntityScorecardRankChipProps) {
  // The hook keeps the previous entity's value while the next one loads.
  const { value, loading } = useEntityScorecard(entity);
  if (loading || !value?.root.scored) return null;
  return <TierChip rank={value.root.rank} emphasis="filled" />;
}
