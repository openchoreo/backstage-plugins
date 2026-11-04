import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  check,
  mockDynamicChecksApi,
  renderWithApis,
} from '../../__testUtils__/testApis';
import { ScorecardsPage } from './ScorecardsPage';

describe('ScorecardsPage', () => {
  it('shows the checks and data sources', async () => {
    await renderWithApis(<ScorecardsPage title="Scorecards" />);

    expect(await screen.findByText('Checks')).toBeInTheDocument();
    expect(screen.getByText('Data sources')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Scorecards' })).toBeVisible();
  });

  it('says when the user may not view checks', async () => {
    await renderWithApis(<ScorecardsPage title="Scorecards" />, {
      canRead: false,
    });

    expect(
      await screen.findByText("You don't have permission to view checks."),
    ).toBeInTheDocument();
    expect(screen.queryByText('Data sources')).not.toBeInTheDocument();
  });

  it('opens the editor for a new check and goes back on cancel', async () => {
    await renderWithApis(<ScorecardsPage title="Scorecards" />, {
      config: {
        techInsights: {
          scorecards: { entityLabel: { singular: 'resource' } },
        },
      },
    });

    const newCheck = await screen.findByRole('button', { name: 'New check' });
    await waitFor(() => expect(newCheck).toBeEnabled());
    await userEvent.click(newCheck);

    expect(
      screen.getByText(
        'Define the check, dry-run it against a sample resource, then save or publish.',
      ),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Data sources')).toBeInTheDocument();
  });

  it('opens a check for editing from its row', async () => {
    const api = mockDynamicChecksApi();
    api.listChecks.mockResolvedValue([check()]);
    await renderWithApis(<ScorecardsPage title="Scorecards" />, { api });

    const row = await screen.findByText('Has a README');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'New check' })).toBeEnabled(),
    );
    await userEvent.click(row);

    expect(
      await screen.findByText('Edit check: Has a README'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByTitle('Back (Esc)'));
    expect(await screen.findByText('Data sources')).toBeInTheDocument();
  });
});
