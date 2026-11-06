import { screen } from '@testing-library/react';
import { renderWithApis } from '../__testUtils__/testApis';
import { ScorecardsPage } from './ScorecardsPage';
import { ScorecardsGate } from './ScorecardsGate';

const turnedOff = { techInsights: { scorecards: { enabled: false } } };

describe('ScorecardsGate', () => {
  it('shows its children when the flag is unset', async () => {
    await renderWithApis(
      <ScorecardsGate>
        <p>Scores</p>
      </ScorecardsGate>,
    );
    expect(screen.getByText('Scores')).toBeInTheDocument();
  });

  it('shows a notice instead of its children when turned off', async () => {
    await renderWithApis(
      <ScorecardsGate>
        <p>Scores</p>
      </ScorecardsGate>,
      { config: turnedOff },
    );
    expect(screen.queryByText('Scores')).not.toBeInTheDocument();
    expect(screen.getByText('Scorecards is turned off')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Scorecards' }),
    ).not.toBeInTheDocument();
  });

  it('shows its fallback instead of the notice when given one', async () => {
    await renderWithApis(
      <ScorecardsGate fallback={null}>
        <p>Scores</p>
      </ScorecardsGate>,
      { config: turnedOff },
    );
    expect(screen.queryByText('Scores')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Scorecards is turned off'),
    ).not.toBeInTheDocument();
  });

  it('keeps the page heading and calls no backend when turned off', async () => {
    const { api } = await renderWithApis(
      <ScorecardsGate pageTitle="Scorecards">
        <ScorecardsPage title="Scorecards" showChecks />
      </ScorecardsGate>,
      { config: turnedOff },
    );
    expect(screen.getByRole('heading', { name: 'Scorecards' })).toBeVisible();
    expect(screen.getByText('Scorecards is turned off')).toBeInTheDocument();
    expect(api.listChecks).not.toHaveBeenCalled();
    expect(api.listFactCollectors).not.toHaveBeenCalled();
  });
});
