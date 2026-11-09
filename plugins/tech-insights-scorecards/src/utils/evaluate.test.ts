import { stringifyEntityRef, type Entity } from '@backstage/catalog-model';
import type { MaturityApi } from '@backstage-community/plugin-tech-insights-maturity';
import { entity, result } from '../__testUtils__/fixtures';
import { evaluateEntities } from './evaluate';

function maturityApi() {
  return {
    getBulkMaturityCheckResults: jest.fn(async (entities: Entity[]) =>
      entities.map(e => ({
        entity: stringifyEntityRef(e),
        rank: 0,
        isMaxRank: false,
        checks: [result(`check-${e.metadata.name}`, 1, true)],
      })),
    ),
  };
}

function components(count: number): Entity[] {
  return Array.from({ length: count }, (_, i) => entity('Component', `c${i}`));
}

describe('evaluateEntities', () => {
  it('makes no call for no entities', async () => {
    const api = maturityApi();
    const results = await evaluateEntities(api as unknown as MaturityApi, []);
    expect(api.getBulkMaturityCheckResults).not.toHaveBeenCalled();
    expect(results.size).toBe(0);
  });

  // An empty chunk would make the backend evaluate every entity with facts.
  it.each([
    [500, [500]],
    [750, [500, 250]],
    [1000, [500, 500]],
    [1001, [500, 500, 1]],
  ])(
    'evaluates %i entities in chunks of %j, never an empty one',
    async (count, sizes) => {
      const api = maturityApi();
      const entities = components(count);
      const results = await evaluateEntities(
        api as unknown as MaturityApi,
        entities,
      );

      const calls = api.getBulkMaturityCheckResults.mock.calls.map(
        ([chunk]) => chunk,
      );
      expect(calls.map(chunk => chunk.length)).toEqual(sizes);
      expect(calls.flat()).toEqual(entities);
      expect(results.size).toBe(count);
      expect(results.get(`component:default/c${count - 1}`)?.[0].check.id).toBe(
        `check-c${count - 1}`,
      );
    },
  );
});
