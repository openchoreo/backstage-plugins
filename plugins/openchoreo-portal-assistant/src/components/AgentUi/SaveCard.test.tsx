import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { AgentUi } from './AgentUi';
import { saveCards } from './changeCards.fixture';

// Hoisted spy — see InvestigateLogButton.test.tsx for the rationale.
const holder: { confirmChange: jest.Mock } = { confirmChange: jest.fn() };

jest.mock('@backstage/core-plugin-api', () => ({
  createApiRef: (config: { id: string }) => ({ id: config.id }),
  useApi: () => ({
    confirmChange: (...args: unknown[]) => holder.confirmChange(...args),
  }),
}));

const buttonTexts = (card: HTMLElement) =>
  within(card)
    .getAllByRole('button')
    .map(button =>
      // An option row is named by its label; its description isn't part of it.
      button.hasAttribute('aria-pressed')
        ? button.getAttribute('aria-label')
        : button.textContent,
    )
    .filter(text => text);

beforeEach(() => {
  holder.confirmChange = jest.fn().mockResolvedValue({
    check_id: 'c1',
    status: 'published',
    message: 'Saved and kept published.',
  });
});

describe('SaveCard', () => {
  it("shows the reply's own words at the top", async () => {
    const [root, ...rest] = saveCards.edit.createSurface.components;
    const withNote = {
      ...saveCards.edit,
      createSurface: {
        ...saveCards.edit.createSurface,
        components: [
          { ...root, note: '**Tested on** `component:default/order-api`' },
          ...rest,
        ],
      },
    };
    render(
      <AgentUi
        messages={[withNote]}
        onAction={jest.fn()}
        renderMarkdown={text => (
          <div data-testid="note">{text.replace(/[*`]/g, '')}</div>
        )}
      />,
    );

    const card = await screen.findByRole('group', { name: /^Save check/ });
    expect(within(card).getByTestId('note').textContent).toBe(
      'Tested on component:default/order-api',
    );
  });

  const testedCard = (
    resultStatus: 'passed' | 'failed' | 'not-applicable' | undefined,
    resultTitle = 'Tested on order-api',
  ) => {
    const [root, ...rest] = saveCards.edit.createSurface.components;
    return {
      ...saveCards.edit,
      createSurface: {
        ...saveCards.edit.createSurface,
        components: [
          {
            ...root,
            resultTitle,
            ...(resultStatus ? { resultStatus } : {}),
            result: ['result_0', 'result_1'],
          },
          ...rest,
          {
            id: 'result_0',
            component: 'RuleLine',
            label: 'Visibility',
            value: 'public',
            mark: 'fail',
            hint: 'the rule wants private',
          },
          {
            id: 'result_1',
            component: 'RuleLine',
            label: 'Archived',
            value: 'No',
            mark: 'pass',
          },
        ],
      },
    };
  };

  it('shows the test it was tried in, a tick or cross per fact', async () => {
    render(<AgentUi messages={[testedCard('failed')]} onAction={jest.fn()} />);

    const card = await screen.findByRole('group', { name: /^Save check/ });
    expect(within(card).getByText('Tested on order-api')).toBeInTheDocument();
    expect(within(card).getByText('public')).toBeInTheDocument();
    expect(
      within(card).getByTitle("doesn't follow the rule"),
    ).toBeInTheDocument();
    expect(
      within(card).getByText('the rule wants private'),
    ).toBeInTheDocument();
    expect(within(card).getByTitle('follows the rule')).toBeInTheDocument();
  });

  it.each([
    ['passed', 'Passed'],
    ['failed', 'Failed'],
    ['not-applicable', "Doesn't apply"],
  ] as const)(
    'highlights a %s result like the test card',
    async (status, words) => {
      // 2026-11-25: the same pill as the test card, next to the heading.
      render(<AgentUi messages={[testedCard(status)]} onAction={jest.fn()} />);

      const card = await screen.findByRole('group', { name: /^Save check/ });
      const heading = within(card).getByText('Tested on order-api');
      const pill = within(card).getByText(words);
      expect(pill.closest('.MuiChip-root')).not.toBeNull();
      expect(heading.parentElement).toContainElement(pill);
    },
  );

  it('keeps an older heading with no status as it is', async () => {
    render(
      <AgentUi
        messages={[testedCard(undefined, 'Tested on order-api: Failed')]}
        onAction={jest.fn()}
      />,
    );

    const card = await screen.findByRole('group', { name: /^Save check/ });
    expect(
      within(card).getByText('Tested on order-api: Failed'),
    ).toBeInTheDocument();
    // No result pill (the card's own status pill stays).
    expect(within(card).queryByText('Failed')).toBeNull();
  });

  it('has no note when the reply has no words of its own', async () => {
    render(
      <AgentUi
        messages={[saveCards.edit]}
        onAction={jest.fn()}
        renderMarkdown={text => <div data-testid="note">{text}</div>}
      />,
    );

    const card = await screen.findByRole('group', { name: /^Save check/ });
    expect(within(card).queryByTestId('note')).toBeNull();
  });

  it('shows an edit as the confirm card, with the change in plain words', async () => {
    render(<AgentUi messages={[saveCards.edit]} onAction={jest.fn()} />);

    const card = await screen.findByRole('group', {
      name: 'Save check Main branch must be protected and require 2 approvals',
    });
    expect(within(card).getByText('Published')).toBeInTheDocument();
    expect(within(card).getByText('Change')).toBeInTheDocument();
    expect(
      within(card).getByText('Approving reviews required before merging'),
    ).toBeInTheDocument();
    expect(within(card).getByText('2 or more')).toBeInTheDocument();
    expect(within(card).getByText('3 or more')).toBeInTheDocument();
    // Everything the confirm card showed before is still there.
    expect(
      within(card).getByText('githubRequiredApprovingReviewCount ≥ 3'),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole('button', { name: 'Copy rule' }),
    ).toBeInTheDocument();
    expect(
      within(card).getByText(
        'Main branch must be protected and require 3 approvals',
      ),
    ).toBeInTheDocument();
    expect(within(card).getByRole('checkbox')).toBeChecked();
    expect(within(card).getByText('Rule is valid')).toBeInTheDocument();
    expect(buttonTexts(card)).toEqual([
      'Save and keep published',
      'Save as draft (unpublish)',
    ]);
  });

  it('saves with the signed token, the chosen status and the texts', async () => {
    const onSaved = jest.fn();
    render(
      <AgentUi
        messages={[saveCards.edit]}
        onAction={jest.fn()}
        onSaved={onSaved}
      />,
    );

    await act(async () => {
      fireEvent.click(
        await screen.findByRole('button', { name: 'Save and keep published' }),
      );
    });

    expect(holder.confirmChange).toHaveBeenCalledWith(
      'signed-token',
      'published',
      true,
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Saved and kept published.',
      ),
    );
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('leaves the texts out when the box is unticked', async () => {
    render(<AgentUi messages={[saveCards.edit]} onAction={jest.fn()} />);

    fireEvent.click(await screen.findByRole('checkbox'));
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Save as draft (unpublish)' }),
      );
    });

    expect(holder.confirmChange).toHaveBeenCalledWith(
      'signed-token',
      'draft',
      false,
    );
  });

  it('is not locked like an old question: it can still be saved later', async () => {
    render(
      <AgentUi messages={[saveCards.edit]} disabled onAction={jest.fn()} />,
    );

    expect(
      await screen.findByRole('button', { name: 'Save and keep published' }),
    ).toBeEnabled();
  });

  it('shows a new check with its rule in plain words and its details', async () => {
    render(<AgentUi messages={[saveCards.create]} onAction={jest.fn()} />);

    const card = await screen.findByRole('group', {
      name: 'Create check Repository must be private',
    });
    expect(within(card).getByText('New check')).toBeInTheDocument();
    expect(
      within(card).getByText('Fails if the repository is public or internal'),
    ).toBeInTheDocument();
    expect(within(card).getByText('What it checks')).toBeInTheDocument();
    expect(within(card).getByText('Repository visibility')).toBeInTheDocument();
    expect(within(card).getByText('private')).toBeInTheDocument();
    expect(
      within(card).getByText(
        'githubRepositoryFactRetriever · Security · Bronze tier',
      ),
    ).toBeInTheDocument();
    expect(within(card).getByText('Applies to: Component')).toBeInTheDocument();
    expect(buttonTexts(card)).toEqual(['Save as draft', 'Save and publish']);
  });
});
