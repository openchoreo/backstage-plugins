import { screen } from '@testing-library/react';
import {
  mockApis,
  renderInTestApp,
  TestApiProvider,
} from '@backstage/test-utils';
import { configApiRef } from '@backstage/core-plugin-api';
import { stringifyEntityRef, type Entity } from '@backstage/catalog-model';
import {
  catalogApiRef,
  EntityProvider,
  entityRouteRef,
} from '@backstage/plugin-catalog-react';
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

  describe('with release lines', () => {
    const web = entity('Component', 'web', [
      'releaseline:default/next',
      'releaseline:default/canary',
    ]);
    const next = entity(
      'ReleaseLine',
      'next',
      ['component:default/web'],
      'partOf',
    );
    const canary = entity(
      'ReleaseLine',
      'canary',
      ['component:default/web'],
      'partOf',
    );
    const own: Record<string, MaturityCheckResult[]> = {
      'component:default/web': [result('desc', Rank.Silver, true)],
      'releaseline:default/next': [result('desc', Rank.Silver, false)],
    };

    async function renderFor(current: Entity) {
      const catalogApi = {
        getEntitiesByRefs: jest.fn(async () => ({ items: [next, canary] })),
      };
      const maturityApi = {
        getBulkMaturityCheckResults: jest.fn(async (entities: Entity[]) =>
          entities.map(e => {
            const ref = stringifyEntityRef(e);
            return { entity: ref, rank: 0, isMaxRank: false, checks: own[ref] };
          }),
        ),
      };
      await renderInTestApp(
        <TestApiProvider
          apis={[
            [catalogApiRef, catalogApi],
            [maturityApiRef, maturityApi],
            [
              configApiRef,
              mockApis.config({
                data: {
                  techInsights: {
                    scorecards: {
                      variants: {
                        kind: 'ReleaseLine',
                        parentKind: 'Component',
                      },
                    },
                  },
                },
              }),
            ],
          ]}
        >
          <EntityProvider entity={current}>
            <EntityScorecardContent />
          </EntityProvider>
        </TestApiProvider>,
        {
          mountedRoutes: {
            '/catalog/:namespace/:kind/:name': entityRouteRef,
          },
        },
      );
    }

    it('scores a component by its main line and lists its lines apart', async () => {
      await renderFor(web);

      expect(
        await screen.findByText('Checks on the main release line'),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/This tier covers only the main release line/),
      ).toBeInTheDocument();
      expect(screen.getByText('Release lines')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'next' })).toHaveAttribute(
        'href',
        '/catalog/default/releaseline/next/scorecards',
      );
    });

    it('lists a release line no check covers among the lines', async () => {
      await renderFor(web);

      expect(
        await screen.findByRole('link', { name: 'canary' }),
      ).toHaveAttribute('href', '/catalog/default/releaseline/canary');
      expect(
        screen.queryByRole('button', { name: /not scored/ }),
      ).not.toBeInTheDocument();
    });

    it('scores a release line on its own and links to its component', async () => {
      await renderFor(next);

      expect(
        await screen.findByText(/This release line is scored on its own/),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'web' })).toHaveAttribute(
        'href',
        '/catalog/default/component/web/scorecards',
      );
      expect(await screen.findByText('Checks')).toBeInTheDocument();
      expect(screen.queryByText('Release lines')).not.toBeInTheDocument();
    });
  });
});
