import { CatalogApi } from '@backstage/plugin-catalog-react';
import { isMarkedForDeletion } from '../DeleteEntity';

/**
 * Counts the channels of an environment that are marked as default, skipping channels
 * being deleted, as the controller does.
 */
export async function countEnvDefaultChannels(
  catalogApi: Pick<CatalogApi, 'getEntities'>,
  namespace: string,
  environment: string,
): Promise<number> {
  const { items } = await catalogApi.getEntities({
    filter: {
      kind: 'ObservabilityAlertsNotificationChannel',
      'metadata.namespace': namespace,
      'spec.environment': environment,
      'spec.isEnvDefault': 'true',
    },
    fields: ['metadata.annotations'],
  });
  return items.filter(channel => !isMarkedForDeletion(channel)).length;
}
