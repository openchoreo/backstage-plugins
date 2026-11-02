import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  apiSchema,
  collector,
  mockDynamicChecksApi,
  renderWithApis,
} from '../../__testUtils__/testApis';
import { FactCollectorsPanel } from './FactCollectorsPanel';

function apiWith(...collectors: ReturnType<typeof collector>[]) {
  const api = mockDynamicChecksApi();
  api.listFactCollectors.mockResolvedValue(collectors);
  return api;
}

/**
 * Steps the fake clock until the panel polls once more than `loads` times.
 * React renders a pending run and sets its poll timer on later tasks, which
 * one large advance can jump past, so the clock moves in small steps that
 * each let those tasks run.
 */
async function advanceToNextPoll(
  api: ReturnType<typeof apiWith>,
  loads: number,
) {
  for (
    let step = 0;
    step < 100 && api.listFactCollectors.mock.calls.length <= loads;
    step++
  ) {
    await act(() => jest.advanceTimersByTimeAsync(100));
  }
  expect(api.listFactCollectors).toHaveBeenCalledTimes(loads + 1);
}

const repo = collector();
const apis = collector({
  id: 'apiFacts',
  cadence: undefined,
  status: 'running',
  lastRunEndedAt: undefined,
  schema: apiSchema,
});

describe('FactCollectorsPanel', () => {
  it('sums up the collectors while collapsed', async () => {
    await renderWithApis(<FactCollectorsPanel />, { api: apiWith(repo, apis) });
    expect(
      await screen.findByText(/^2 collectors, last collected/),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 collecting now/)).toBeInTheDocument();
  });

  it('lists each collector once expanded', async () => {
    await renderWithApis(<FactCollectorsPanel />, {
      api: apiWith(repo, apis),
      config: { techInsights: { scorecards: { kindLabels: { API: 'APIs' } } } },
    });
    await userEvent.click(await screen.findByLabelText('Show data sources'));

    expect(screen.getByText('0 * * * *')).toBeInTheDocument();
    expect(screen.getByText('Running now')).toBeInTheDocument();
    expect(screen.getByText('APIs')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collecting…' })).toBeDisabled();
  });

  it('shows the facts a collector provides', async () => {
    await renderWithApis(<FactCollectorsPanel />, { api: apiWith(repo, apis) });
    await userEvent.click(await screen.findByLabelText('Show data sources'));

    await userEvent.click(screen.getByLabelText('About repoFacts'));
    expect(screen.getByText('hasReadme')).toBeInTheDocument();
    expect(screen.getByText('The repository has a README')).toBeInTheDocument();
  });

  it('starts a collection now', async () => {
    const { api } = await renderWithApis(<FactCollectorsPanel />, {
      api: apiWith(repo),
    });
    await userEvent.click(await screen.findByLabelText('Show data sources'));

    await userEvent.click(screen.getByRole('button', { name: 'Collect now' }));
    expect(api.triggerFactCollector).toHaveBeenCalledWith('repoFacts');
    expect(
      await screen.findByRole('button', { name: 'Collecting…' }),
    ).toBeDisabled();
  });

  it('enables Collect now again once the run finishes', async () => {
    const api = apiWith(repo);
    const onCollected = jest.fn();
    await renderWithApis(<FactCollectorsPanel onCollected={onCollected} />, {
      api,
    });
    await userEvent.click(await screen.findByLabelText('Show data sources'));

    api.listFactCollectors
      .mockResolvedValueOnce([collector({ status: 'running' })])
      .mockResolvedValue([
        collector({ lastRunEndedAt: '2026-01-01T02:00:00.000Z' }),
      ]);
    jest.useFakeTimers({
      doNotFake: ['queueMicrotask', 'setImmediate', 'nextTick'],
    });
    try {
      const loads = api.listFactCollectors.mock.calls.length;
      await userEvent.click(
        screen.getByRole('button', { name: 'Collect now' }),
        { advanceTimers: jest.advanceTimersByTime },
      );

      await advanceToNextPoll(api, loads);
      expect(
        screen.getByRole('button', { name: 'Collecting…' }),
      ).toBeDisabled();
      expect(onCollected).not.toHaveBeenCalled();

      await act(() => jest.advanceTimersByTimeAsync(3000));
      expect(screen.getByRole('button', { name: 'Collect now' })).toBeEnabled();
      expect(onCollected).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('stops waiting for a run that never reports back', async () => {
    const api = apiWith(repo);
    const onCollected = jest.fn();
    await renderWithApis(<FactCollectorsPanel onCollected={onCollected} />, {
      api,
    });
    await userEvent.click(await screen.findByLabelText('Show data sources'));

    api.listFactCollectors.mockResolvedValue([
      collector({ status: 'running' }),
    ]);
    jest.useFakeTimers({
      doNotFake: ['queueMicrotask', 'setImmediate', 'nextTick'],
    });
    try {
      const loads = api.listFactCollectors.mock.calls.length;
      await userEvent.click(
        screen.getByRole('button', { name: 'Collect now' }),
        { advanceTimers: jest.advanceTimersByTime },
      );
      await advanceToNextPoll(api, loads);

      await act(() => jest.advanceTimersByTimeAsync(5 * 60 * 1000));
      expect(
        screen.queryByText(/No finished run seen/),
      ).not.toBeInTheDocument();

      await act(() => jest.advanceTimersByTimeAsync(2 * 60 * 1000));
      expect(
        screen.getByText(
          'No finished run seen for repoFacts; check the backend logs.',
        ),
      ).toBeInTheDocument();
      const calls = api.listFactCollectors.mock.calls.length;
      await act(() => jest.advanceTimersByTimeAsync(10_000));
      expect(api.listFactCollectors).toHaveBeenCalledTimes(calls);
      expect(onCollected).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('says when a collection was already running', async () => {
    const api = apiWith(repo);
    api.triggerFactCollector.mockResolvedValue('already-running');
    await renderWithApis(<FactCollectorsPanel />, { api });
    await userEvent.click(await screen.findByLabelText('Show data sources'));

    await userEvent.click(screen.getByRole('button', { name: 'Collect now' }));
    expect(
      await screen.findByText(/repoFacts is already collecting/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collecting…' })).toBeDisabled();
  });

  it('shows why a collection failed to start', async () => {
    const api = apiWith(repo);
    api.triggerFactCollector.mockRejectedValue(new Error('Not allowed.'));
    await renderWithApis(<FactCollectorsPanel />, { api });
    await userEvent.click(await screen.findByLabelText('Show data sources'));

    await userEvent.click(screen.getByRole('button', { name: 'Collect now' }));
    expect(await screen.findByText('Not allowed.')).toBeInTheDocument();
  });

  it('disables Collect now without the manage permission', async () => {
    await renderWithApis(<FactCollectorsPanel />, {
      api: apiWith(repo),
      canManage: false,
    });
    await userEvent.click(await screen.findByLabelText('Show data sources'));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Collect now' }),
      ).toBeDisabled(),
    );
  });

  it('says when no collectors are scheduled', async () => {
    await renderWithApis(<FactCollectorsPanel />, { api: apiWith() });
    expect(
      await screen.findAllByText('No fact collectors are scheduled.'),
    ).not.toHaveLength(0);
  });

  it('shows the error when collectors fail to load', async () => {
    const api = mockDynamicChecksApi();
    api.listFactCollectors.mockRejectedValue(new Error('Scheduler down'));
    await renderWithApis(<FactCollectorsPanel />, { api });
    expect(
      await screen.findByText('Error: Scheduler down', { selector: 'h6' }),
    ).toBeInTheDocument();
  });
});
