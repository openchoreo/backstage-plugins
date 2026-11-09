import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { catalogApiRef, EntityProvider } from '@backstage/plugin-catalog-react';
import { maturityApiRef } from '@backstage-community/plugin-tech-insights-maturity';
import {
  Rank,
  type MaturityCheckResult,
} from '@backstage-community/plugin-tech-insights-maturity-common';
import { entity, result } from '../../__testUtils__/fixtures';
import { EntityScorecardContent } from './EntityScorecardContent';

function inCategory(
  check: MaturityCheckResult,
  category: string,
): MaturityCheckResult {
  return {
    ...check,
    check: {
      ...check.check,
      metadata: { ...check.check.metadata, category },
    },
  };
}

describe('EntityScorecardContent', () => {
  it('expands the category of a failing check without a tier first', async () => {
    const component = entity('Component', 'api');
    const unranked = inCategory(result('unranked', Rank.Stone, false), 'Docs');
    delete (unranked.check.metadata as { rank?: number }).rank;
    const gold = inCategory(result('gold', Rank.Gold, true), 'Security');
    const maturityApi = {
      getBulkMaturityCheckResults: jest.fn(async () => [
        {
          entity: stringifyEntityRef(component),
          rank: 0,
          isMaxRank: false,
          checks: [gold, unranked],
        },
      ]),
    };

    await renderInTestApp(
      <TestApiProvider
        apis={[
          [catalogApiRef, { getEntitiesByRefs: jest.fn() }],
          [maturityApiRef, maturityApi],
        ]}
      >
        <EntityProvider entity={component}>
          <EntityScorecardContent />
        </EntityProvider>
      </TestApiProvider>,
    );

    const docs = await screen.findByRole('button', { name: /Docs/ });
    const security = screen.getByRole('button', { name: /Security/ });
    expect(docs).toHaveAttribute('aria-expanded', 'true');
    expect(security).toHaveAttribute('aria-expanded', 'false');
    expect(
      docs.compareDocumentPosition(security) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
