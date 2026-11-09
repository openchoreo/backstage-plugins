import { Rank } from '@backstage-community/plugin-tech-insights-maturity-common';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithApis } from '../../__testUtils__/testApis';
import { entity, result } from '../../__testUtils__/fixtures';
import { createRollup, normalizeRef } from '../../utils/rollup';
import { CheckScores } from './CheckScores';

const api = entity('Component', 'api');
const worker = entity('Component', 'worker');
const rollup = createRollup(
  new Map([api, worker].map(e => [normalizeRef(e), e])),
  new Map([
    ['component:default/api', [result('readme', Rank.Bronze, true)]],
    ['component:default/worker', [result('readme', Rank.Bronze, false)]],
  ]),
);

describe('CheckScores', () => {
  it("lists a check's entities from the keyboard", async () => {
    await renderWithApis(
      <CheckScores
        nodes={[
          rollup('component:default/api')!,
          rollup('component:default/worker')!,
        ]}
        itemsLabel="Components"
      />,
    );

    const toggle = screen.getByRole('button', {
      name: 'Show Components for readme',
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    toggle.focus();
    await userEvent.keyboard('{Enter}');

    expect(
      screen.getByRole('button', { name: 'Hide Components for readme' }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Failing')).toBeInTheDocument();
    expect(screen.getByText('Passing')).toBeInTheDocument();
  });
});
