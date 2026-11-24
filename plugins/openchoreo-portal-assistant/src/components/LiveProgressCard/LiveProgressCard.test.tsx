import { act, render, screen, within } from '@testing-library/react';
import type { DryRunResult } from '../../api/PortalAssistantApi';
import { LiveProgressCard } from './LiveProgressCard';

const failed: DryRunResult = {
  type: 'dry_run_result',
  status: 'failed',
  title: 'order-api',
  subtitle: 'Component',
  summary: "order-api doesn't meet this rule.",
  sections: [
    {
      label: 'What the rule needs',
      lines: [{ label: 'Repository visibility', value: 'private' }],
    },
    {
      label: 'What order-api has',
      lines: [{ label: 'Repository visibility', value: 'public' }],
    },
  ],
};

describe('LiveProgressCard', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('says it is thinking before the first step', () => {
    render(<LiveProgressCard steps={[]} startedAt={Date.now()} />);

    const card = screen.getByRole('status', { name: 'Working on it' });
    expect(within(card).getByText('Thinking')).toBeInTheDocument();
    expect(within(card).queryByRole('listitem')).toBeNull();
  });

  it('shows the step it is on now, on one line, with a spinner and no ticks', () => {
    // 2026-11-25: the line changes in place the moment a step comes, so it
    // is never behind; no list of steps.
    const { rerender } = render(
      <LiveProgressCard steps={['Checking the rule']} startedAt={Date.now()} />,
    );
    const card = screen.getByRole('status', { name: 'Working on it' });
    expect(within(card).getByText('Checking the rule')).toBeInTheDocument();

    rerender(
      <LiveProgressCard
        steps={['Checking the rule', 'Thinking', 'Writing the reply']}
        startedAt={Date.now()}
      />,
    );

    expect(within(card).getByText('Writing the reply')).toBeInTheDocument();
    expect(within(card).queryByText('Checking the rule')).toBeNull();
    expect(within(card).queryByText('Thinking')).toBeNull();
    expect(
      within(card).getByRole('progressbar', { name: 'In progress' }),
    ).toBeInTheDocument();
    expect(within(card).queryByRole('listitem')).toBeNull();
    expect(within(card).queryByTitle('Done')).toBeNull();
  });

  it('counts the seconds since the turn started', () => {
    jest.useFakeTimers();
    render(
      <LiveProgressCard steps={['Checking the rule']} startedAt={Date.now()} />,
    );
    expect(screen.getByText('· 0s', { exact: false })).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(screen.getByText('· 3s', { exact: false })).toBeInTheDocument();
  });

  it('once ready, says how long it took on the same line, with no icon', () => {
    jest.useFakeTimers();
    const startedAt = Date.now();
    jest.advanceTimersByTime(9000);
    render(
      <LiveProgressCard
        steps={['Checking the rule', 'Writing the reply']}
        startedAt={startedAt}
        ready
      />,
    );

    const card = screen.getByRole('status', { name: 'Ready' });
    expect(within(card).getByText('Done in 9s')).toBeInTheDocument();
    expect(within(card).queryByText('Writing the reply')).toBeNull();
    expect(within(card).queryByTitle('Done')).toBeNull();
    expect(within(card).queryByRole('progressbar')).toBeNull();

    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(within(card).getByText('Done in 9s')).toBeInTheDocument();
  });

  it("shows a dry-run's result in its test card's words", () => {
    render(
      <LiveProgressCard
        steps={['Testing the check']}
        result={failed}
        startedAt={Date.now()}
      />,
    );

    const card = screen.getByRole('status');
    expect(within(card).getByText('Test on order-api')).toBeInTheDocument();
    expect(within(card).getByText('Failed')).toBeInTheDocument();
    expect(
      within(card).getByText("order-api doesn't meet this rule."),
    ).toBeInTheDocument();
    expect(within(card).getByText('What the rule needs')).toBeInTheDocument();
    expect(within(card).getByText('private')).toBeInTheDocument();
    expect(within(card).getByText('What order-api has')).toBeInTheDocument();
    expect(within(card).getByText('public')).toBeInTheDocument();
  });
});
