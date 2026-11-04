import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  mockDynamicChecksApi,
  renderWithApis,
} from '../../__testUtils__/testApis';
import type { DryRunResult } from '../../api/types';
import { DryRunResultView } from './DryRunResultView';

const result: DryRunResult = {
  status: 'failed',
  entityRef: 'component:default/api',
  reasons: [
    {
      code: 'no-facts',
      message: 'repoFacts has no facts for this entity yet.',
      factRetrieverId: 'repoFacts',
    },
  ],
  conditions: {
    all: [
      {
        fact: 'hasReadme',
        operator: 'equal',
        value: true,
        factResult: false,
        result: false,
      },
      {
        any: [
          {
            not: {
              fact: 'owner',
              operator: 'equal',
              value: 'nobody',
              factResult: null,
            },
          },
        ],
      },
    ],
  },
  collectedAt: { repoFacts: '2026-01-01T00:00:00.000Z' },
};

describe('DryRunResultView', () => {
  it('shows each evaluated condition and when its facts were collected', async () => {
    await renderWithApis(<DryRunResultView result={result} />);

    expect(
      screen.getByText('Failed for component:default/api'),
    ).toBeInTheDocument();
    const [, readme, owner] = screen.getAllByRole('row');
    expect(
      within(readme)
        .getAllByRole('cell')
        .map(cell => cell.textContent),
    ).toEqual(['hasReadme', 'false', 'equal true', 'Failed']);
    expect(
      within(owner)
        .getAllByRole('cell')
        .map(cell => cell.textContent),
    ).toEqual(['owner', 'No value', 'not equal "nobody"', '—']);
    expect(screen.getByText(/repoFacts: facts collected/)).toBeInTheDocument();
  });

  it('shows the result of a negated condition, not of the condition it negates', async () => {
    await renderWithApis(
      <DryRunResultView
        result={{
          ...result,
          conditions: {
            not: {
              fact: 'hasReadme',
              operator: 'equal',
              value: true,
              factResult: true,
              result: true,
            },
          },
        }}
      />,
    );
    const [, row] = screen.getAllByRole('row');
    expect(
      within(row)
        .getAllByRole('cell')
        .map(cell => cell.textContent),
    ).toEqual(['hasReadme', 'true', 'not equal true', 'Failed']);
  });

  it('shows a status it does not recognise', async () => {
    await renderWithApis(
      <DryRunResultView
        result={{
          ...result,
          status: 'stale' as DryRunResult['status'],
          conditions: undefined,
        }}
      />,
    );
    expect(
      screen.getByText('Unrecognised result for component:default/api'),
    ).toBeInTheDocument();
  });

  it('collects missing facts now', async () => {
    const { api } = await renderWithApis(<DryRunResultView result={result} />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Collect now' }),
    );
    expect(api.triggerFactCollector).toHaveBeenCalledWith('repoFacts');
    expect(
      await screen.findByText(/Collection started. Dry-run again/),
    ).toBeInTheDocument();
  });

  it('says when the collection was already running', async () => {
    const api = mockDynamicChecksApi();
    api.triggerFactCollector.mockResolvedValue('already-running');
    await renderWithApis(<DryRunResultView result={result} />, { api });

    await userEvent.click(
      await screen.findByRole('button', { name: 'Collect now' }),
    );
    expect(await screen.findByText(/Already collecting/)).toBeInTheDocument();
  });

  it('shows why the collection failed to start', async () => {
    const api = mockDynamicChecksApi();
    api.triggerFactCollector.mockRejectedValue(new Error('Not allowed.'));
    await renderWithApis(<DryRunResultView result={result} />, { api });

    await userEvent.click(
      await screen.findByRole('button', { name: 'Collect now' }),
    );
    expect(await screen.findByText('Not allowed.')).toBeInTheDocument();
  });

  it('describes a check that cannot be evaluated', async () => {
    await renderWithApis(
      <DryRunResultView
        result={{
          status: 'invalid',
          entityRef: 'component:default/api',
          reasons: [{ code: 'invalid-rule', message: 'Unknown operator.' }],
          collectedAt: {},
        }}
      />,
    );
    expect(
      screen.getByText(
        "The check can't be evaluated for component:default/api",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Unknown operator.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
