import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { entity, result } from '../../__testUtils__/fixtures';
import {
  check,
  mockCatalogApi,
  mockDynamicChecksApi,
  mockMaturityApi,
  renderWithApis,
} from '../../__testUtils__/testApis';
import { ScorecardsPage } from './ScorecardsPage';

describe('ScorecardsPage', () => {
  it('shows the score summary, checks and data sources', async () => {
    await renderWithApis(<ScorecardsPage title="Scorecards" showChecks />);

    expect(await screen.findByText('Checks')).toBeInTheDocument();
    expect(screen.getByText('Data sources')).toBeInTheDocument();
    expect(screen.getByText(/View full breakdown/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Scorecards' })).toBeVisible();
  });

  it('says when the user may not view scores and checks', async () => {
    await renderWithApis(<ScorecardsPage title="Scorecards" showChecks />, {
      canRead: false,
    });

    expect(
      await screen.findByText(
        /You don't have permission to view scores and checks across all entities/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Data sources')).not.toBeInTheDocument();
  });

  it('shows only scores when checks are stored elsewhere', async () => {
    const component = entity('Component', 'api');
    const readme = result('readme', 1, true);
    const catalogApi = mockCatalogApi();
    catalogApi.getEntities.mockResolvedValue({ items: [component] });
    const maturityApi = mockMaturityApi();
    maturityApi.getAllChecks.mockResolvedValue([
      { ...readme.check, filter: { kind: 'Component' } },
    ]);
    maturityApi.getBulkMaturityCheckResults.mockResolvedValue([
      {
        entity: 'component:default/api',
        rank: 0,
        isMaxRank: false,
        checks: [readme],
      },
    ]);
    await renderWithApis(
      <ScorecardsPage title="Scorecards" showChecks={false} />,
      { canRead: false, catalogApi, maturityApi },
    );

    expect(
      await screen.findByText(/1 of 1 checks pass across 1/),
    ).toBeInTheDocument();
    expect(screen.getByText(/View full breakdown/)).toBeInTheDocument();
    expect(screen.queryByText('Checks')).not.toBeInTheDocument();
    expect(screen.queryByText('Data sources')).not.toBeInTheDocument();
  });

  it('opens the editor for a new check and goes back on cancel', async () => {
    await renderWithApis(<ScorecardsPage title="Scorecards" showChecks />, {
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
    await renderWithApis(<ScorecardsPage title="Scorecards" showChecks />, {
      api,
    });

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
