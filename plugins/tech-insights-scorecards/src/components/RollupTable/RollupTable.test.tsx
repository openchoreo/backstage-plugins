import { Rank } from '@backstage-community/plugin-tech-insights-maturity-common';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithApis } from '../../__testUtils__/testApis';
import { entity, result } from '../../__testUtils__/fixtures';
import { createRollup, normalizeRef } from '../../utils/rollup';
import { RollupTable } from './RollupTable';

const api = entity('Component', 'api');
const dev = entity('Environment', 'dev');
const entities = new Map([api, dev].map(e => [normalizeRef(e), e]));
const rollup = createRollup(
  entities,
  new Map([['component:default/api', [result('desc', Rank.Bronze, true)]]]),
);

const variants = { kind: 'ReleaseLine', parentKind: 'Component' };
const web = entity('Component', 'web', [
  'releaseline:default/next',
  'releaseline:default/canary',
]);
const next = entity('ReleaseLine', 'next');
next.metadata.title = 'web:next';
const canary = entity('ReleaseLine', 'canary');
const withLines = createRollup(
  new Map([web, next, canary].map(e => [normalizeRef(e), e])),
  new Map([
    ['component:default/web', [result('desc', Rank.Bronze, true)]],
    ['releaseline:default/next', [result('desc', Rank.Bronze, false)]],
  ]),
  { ...variants, mainLabel: 'main' },
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

  it('counts the release lines of a component and expands to all of them, main first', async () => {
    await renderWithApis(
      <RollupTable
        nodes={[withLines('component:default/web')!]}
        expandable
        showKind={false}
      />,
      { config: { techInsights: { scorecards: { variants } } } },
    );

    expect(screen.getByText('3 release lines')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'main' }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('row')[1].textContent).toContain('1/1 (100%)');

    await userEvent.click(screen.getByRole('button', { name: 'Expand' }));
    const rows = screen.getAllByRole('row').map(row => row.textContent);
    // The component's score moves down to its main line.
    expect(rows[1]).toBe('web3 release lines');
    expect(rows[2]).toMatch(/^mainSets the component's tier/);
    expect(rows[2]).toContain('1/1 (100%)');
    expect(rows[3]).toMatch(/^next/);
    expect(rows[4]).toMatch(/^canary/);
    // Main carries the component's score, so it links to the component.
    expect(screen.getByRole('link', { name: 'main' })).toHaveAttribute(
      'href',
      '/catalog/default/component/web/scorecards',
    );
    // Named without the component's prefix, and linked to its own tab.
    expect(screen.getByRole('link', { name: 'next' })).toHaveAttribute(
      'href',
      '/catalog/default/releaseline/next/scorecards',
    );
    expect(screen.queryByText('web:next')).not.toBeInTheDocument();
    // A line no check covers is listed too, so the rows match the count.
    expect(screen.getByRole('link', { name: 'canary' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /not scored/ }),
    ).not.toBeInTheDocument();
  });
});
