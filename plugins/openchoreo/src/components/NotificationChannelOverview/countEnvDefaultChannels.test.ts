import { Entity } from '@backstage/catalog-model';
import { countEnvDefaultChannels } from './countEnvDefaultChannels';

const channel = (deleting = false): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'ObservabilityAlertsNotificationChannel',
  metadata: {
    name: 'ch',
    annotations: deleting
      ? { 'openchoreo.io/deletion-timestamp': '2026-01-01T00:00:00Z' }
      : {},
  },
});

describe('countEnvDefaultChannels', () => {
  it('asks the catalog for the marked channels of the environment', async () => {
    const getEntities = jest.fn().mockResolvedValue({ items: [] });

    await countEnvDefaultChannels({ getEntities }, 'my-ns', 'dev');

    expect(getEntities).toHaveBeenCalledWith({
      filter: {
        kind: 'ObservabilityAlertsNotificationChannel',
        'metadata.namespace': 'my-ns',
        'spec.environment': 'dev',
        'spec.isEnvDefault': 'true',
      },
      fields: ['metadata.annotations'],
    });
  });

  it('skips channels that are being deleted', async () => {
    const getEntities = jest.fn().mockResolvedValue({
      items: [channel(), channel(true), channel()],
    });

    await expect(
      countEnvDefaultChannels({ getEntities }, 'my-ns', 'dev'),
    ).resolves.toBe(2);
  });
});
