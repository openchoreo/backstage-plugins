import { useMemo } from 'react';
import { configApiRef, useApi } from '@backstage/core-plugin-api';
import { TIER_CONFIG_KEY, TIER_LABEL } from '../tierPalette';

/**
 * The name to show for a tier: `techInsights.maturity.rank.<tier>.title`,
 * the key the maturity plugin reads, else the default name.
 */
export function useTierLabel(): (rank: number) => string {
  const config = useApi(configApiRef);
  return useMemo(() => {
    const labels = new Map<number, string>();
    for (const [rank, key] of Object.entries(TIER_CONFIG_KEY)) {
      const title = config.getOptionalString(
        `techInsights.maturity.rank.${key}.title`,
      );
      labels.set(Number(rank), title ?? TIER_LABEL[Number(rank)]);
    }
    return (rank: number) => labels.get(rank) ?? String(rank);
  }, [config]);
}
