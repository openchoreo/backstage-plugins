import { render, screen } from '@testing-library/react';
import { ReleaseLinesSummaryCell } from './ReleaseLinesSummaryCell';

describe('ReleaseLinesSummaryCell', () => {
  it('counts the lines and their deployments', () => {
    render(
      <ReleaseLinesSummaryCell
        releaseLines={[
          { name: 'main', environments: ['development'] },
          { name: 'next', environments: ['development', 'staging'] },
        ]}
      />,
    );

    expect(
      screen.getByText('2 release lines · 3 deployments'),
    ).toBeInTheDocument();
  });

  it('uses the singular for one of each', () => {
    render(
      <ReleaseLinesSummaryCell
        releaseLines={[{ name: 'main', environments: ['development'] }]}
      />,
    );

    expect(
      screen.getByText('1 release line · 1 deployment'),
    ).toBeInTheDocument();
  });
});
