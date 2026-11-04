import { configApiRef, useApi } from '@backstage/core-plugin-api';

/** The categories the check editor suggests: `techInsights.scorecards.categories`. */
export function useCheckCategories(): string[] {
  return (
    useApi(configApiRef).getOptionalStringArray(
      'techInsights.scorecards.categories',
    ) ?? []
  );
}
