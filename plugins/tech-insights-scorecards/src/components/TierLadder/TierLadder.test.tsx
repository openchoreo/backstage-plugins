import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import { Rank } from '@backstage-community/plugin-tech-insights-maturity-common';
import { result } from '../../__testUtils__/fixtures';
import { TierLadder } from './TierLadder';

describe('TierLadder', () => {
  it('ticks the tiers reached with every check passing', async () => {
    await renderInTestApp(
      <TierLadder
        checks={[
          result('stone', Rank.Stone, true),
          result('bronze', Rank.Bronze, true),
          result('silver', Rank.Silver, false),
        ]}
      />,
    );
    expect(screen.getAllByLabelText('reached')).toHaveLength(2);
  });

  it('leaves Stone unticked while a Stone check fails', async () => {
    await renderInTestApp(
      <TierLadder
        checks={[
          result('stone', Rank.Stone, false),
          result('bronze', Rank.Bronze, true),
        ]}
      />,
    );
    expect(screen.getByText('0/1')).toBeInTheDocument();
    expect(screen.queryByLabelText('reached')).not.toBeInTheDocument();
  });
});
