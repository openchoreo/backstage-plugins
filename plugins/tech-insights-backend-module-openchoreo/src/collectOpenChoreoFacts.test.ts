import type { Entity } from '@backstage/catalog-model';
import { mockServices } from '@backstage/backend-test-utils';
import type { FactRetrieverContext } from '@backstage-community/plugin-tech-insights-node';
import { collectOpenChoreoFacts } from './collectOpenChoreoFacts';

const mockGetEntities = jest.fn();
jest.mock('@backstage/catalog-client', () => ({
  CatalogClient: jest.fn().mockImplementation(() => ({
    getEntities: mockGetEntities,
  })),
}));

function entity(name: string): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { name, namespace: 'default' },
  };
}

describe('collectOpenChoreoFacts', () => {
  it('moves on when an entity runs past its deadline', async () => {
    mockGetEntities.mockResolvedValue({
      items: [entity('stuck'), entity('fine')],
    });
    const logger = mockServices.logger.mock();
    const signals: AbortSignal[] = [];

    const results = await collectOpenChoreoFacts(
      {
        discovery: mockServices.discovery(),
        auth: mockServices.auth(),
        logger,
        entityFilter: [{ kind: 'component' }],
      } as unknown as FactRetrieverContext,
      async () => undefined,
      async (e, _prepared, signal) => {
        signals.push(signal);
        if (e.metadata.name === 'stuck') {
          return new Promise(() => {});
        }
        return { ok: true };
      },
      { deadlineMs: 50 },
    );

    expect(results.map(r => r.entity.name)).toEqual(['fine']);
    expect(signals[0].aborted).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Skipping component:default/stuck'),
    );
  });
});
