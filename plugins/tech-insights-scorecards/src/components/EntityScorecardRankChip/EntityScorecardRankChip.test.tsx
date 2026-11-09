import { useState } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import { stringifyEntityRef, type Entity } from '@backstage/catalog-model';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { maturityApiRef } from '@backstage-community/plugin-tech-insights-maturity';
import { Rank } from '@backstage-community/plugin-tech-insights-maturity-common';
import { entity, result } from '../../__testUtils__/fixtures';
import { EntityScorecardRankChip } from './EntityScorecardRankChip';

const gold = entity('Component', 'gold');
const next = entity('Component', 'next');

function Harness() {
  const [current, setCurrent] = useState<Entity>(gold);
  return (
    <>
      <button onClick={() => setCurrent(next)}>Next</button>
      <EntityScorecardRankChip entity={current} />
    </>
  );
}

describe('EntityScorecardRankChip', () => {
  it("hides the previous entity's tier while the next one loads", async () => {
    const maturityApi = {
      getBulkMaturityCheckResults: jest.fn(async (entities: Entity[]) => {
        if (entities[0] === next) return new Promise<never>(() => {});
        return [
          {
            entity: stringifyEntityRef(gold),
            rank: 0,
            isMaxRank: false,
            checks: [result('gold', Rank.Gold, true)],
          },
        ];
      }),
    };
    await renderInTestApp(
      <TestApiProvider
        apis={[
          [catalogApiRef, { getEntitiesByRefs: jest.fn() }],
          [maturityApiRef, maturityApi],
        ]}
      >
        <Harness />
      </TestApiProvider>,
    );

    expect(await screen.findByText('Gold')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.queryByText('Gold')).not.toBeInTheDocument();
  });
});
