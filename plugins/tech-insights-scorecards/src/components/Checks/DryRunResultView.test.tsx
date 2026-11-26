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

  it('shows what a path selected beside a preview of the fact', async () => {
    const shards = [
      { name: 'a', primary: true, healthy: true },
      { name: 'b', primary: true, healthy: false },
    ];
    await renderWithApis(
      <DryRunResultView
        result={{
          ...result,
          reasons: [],
          conditions: {
            all: [
              {
                fact: 'shards',
                path: '$[?(@.primary)].healthy',
                operator: 'everyFact:equal',
                value: true,
                factResult: [true, false],
                factPreview: JSON.stringify(shards),
                result: false,
              },
              {
                fact: 'shards',
                path: '$[?(@.replicas)].healthy',
                operator: 'someFact:equal',
                value: true,
                factPreview: JSON.stringify(shards),
                selectedNothing: true,
                result: false,
              },
            ],
          },
        }}
      />,
    );
    const [, selected, empty] = screen.getAllByRole('row');
    expect(
      within(selected)
        .getAllByRole('cell')
        .map(cell => cell.textContent),
    ).toEqual([
      'shards$[?(@.primary)].healthy',
      `[true,false]from ${JSON.stringify(shards)}`,
      'everyFact:equal true',
      'Failed',
    ]);
    expect(within(empty).getAllByRole('cell')[1].textContent).toBe(
      `Nothing selectedfrom ${JSON.stringify(shards)}`,
    );
  });

  it.each([
    ['selected nothing', { selectedNothing: true, result: false }, 'Passed'],
    [
      'selected values that pass',
      { factResult: [false], result: false },
      'Passed',
    ],
    [
      'selected values that fail',
      { factResult: [true], result: true },
      'Failed',
    ],
  ])(
    'shows the outcome of a negated path condition that %s',
    async (_label, evaluated, outcome) => {
      await renderWithApis(
        <DryRunResultView
          result={{
            ...result,
            reasons: [],
            conditions: {
              not: {
                fact: 'shards',
                path: '$[?(@.primary)].healthy',
                operator: 'everyFact:equal',
                value: true,
                factPreview: '[]',
                ...evaluated,
              },
            },
          }}
        />,
      );
      const [, row] = screen.getAllByRole('row');
      const cells = within(row)
        .getAllByRole('cell')
        .map(cell => cell.textContent);
      expect(cells[2]).toBe('not everyFact:equal true');
      expect(cells[3]).toBe(outcome);
    },
  );

  it('cuts long values with a marker', async () => {
    const long = Array.from({ length: 100 }, (_, i) => `entry-${i}`);
    const preview = 'x'.repeat(300);
    await renderWithApis(
      <DryRunResultView
        result={{
          ...result,
          reasons: [],
          conditions: {
            all: [
              {
                fact: 'shards',
                path: '$[*].name',
                operator: 'everyFact:notEqual',
                value: '',
                factResult: long,
                factPreview: preview,
                factPreviewTruncated: true,
                result: true,
              },
            ],
          },
        }}
      />,
    );
    const [, row] = screen.getAllByRole('row');
    const actual = within(row).getAllByRole('cell')[1].textContent;
    expect(actual).toBe(
      `${JSON.stringify(long).slice(0, 300)}… (truncated)` +
        `from ${preview}… (truncated)`,
    );
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
