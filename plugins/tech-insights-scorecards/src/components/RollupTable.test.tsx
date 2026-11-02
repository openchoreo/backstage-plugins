import { Rank } from '@backstage-community/plugin-tech-insights-maturity-common';
import { screen } from '@testing-library/react';
import { renderWithApis } from '../__testUtils__/testApis';
import { createRollup, normalizeRef } from '../rollup';
import { entity, result } from '../testUtils';
import { RollupTable } from './RollupTable';

const api = entity('Component', 'api');
const dev = entity('Environment', 'dev');
const entities = new Map([api, dev].map(e => [normalizeRef(e), e]));
const rollup = createRollup(
  entities,
  new Map([['component:default/api', [result('desc', Rank.Bronze, true)]]]),
);

describe('RollupTable', () => {
  it('links a scored entity to its tab and an unscored one to its page, which may have no tab', async () => {
    await renderWithApis(
      <RollupTable
        nodes={[
          rollup('component:default/api')!,
          rollup('environment:default/dev')!,
        ]}
        unscored="show"
      />,
    );

    expect(screen.getByRole('link', { name: /api/ })).toHaveAttribute(
      'href',
      '/catalog/default/component/api/scorecards',
    );
    expect(screen.getByRole('link', { name: /dev/ })).toHaveAttribute(
      'href',
      '/catalog/default/environment/dev',
    );
  });
});
