import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { AgentUi, hasReplyCard } from './AgentUi';
import { noticeCards, withAnswer } from './changeCards.fixture';

describe('NoticeCard', () => {
  it('shows the README reply as a clear card with the close facts and other options', async () => {
    render(<AgentUi messages={[noticeCards.noFact]} onAction={jest.fn()} />);

    const card = await screen.findByRole('group', {
      name: "Can't build this check yet",
    });
    expect(
      within(card).getByText(
        "There's no fact for whether a README file exists.",
      ),
    ).toBeInTheDocument();
    expect(
      within(card).getByText('You could check instead'),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole('button', { name: 'A CODEOWNERS file exists' }),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole('button', { name: 'A SECURITY.md file exists' }),
    ).toBeInTheDocument();
    expect(within(card).getByText('Or did you mean')).toBeInTheDocument();
    expect(
      within(card).getByRole('button', {
        name: 'Must have README in a specific path',
      }),
    ).toBeInTheDocument();
    expect(
      within(card).getByText('Or describe a different check in the chat.'),
    ).toBeInTheDocument();
    // No technical fact names on the card.
    expect(card.textContent).not.toMatch(/githubHas/);
  });

  it('lists checks to write instead as words, with its question and nothing to click', async () => {
    render(
      <AgentUi messages={[noticeCards.noFactIdeas]} onAction={jest.fn()} />,
    );

    const card = await screen.findByRole('group', {
      name: "Can't build this check yet",
    });
    expect(
      within(card).getByText('Checks you could write instead'),
    ).toBeInTheDocument();
    expect(
      within(card)
        .getAllByRole('listitem')
        .map(item => item.textContent),
    ).toEqual([
      'The repo must not be archived',
      'The default branch must be protected',
    ]);
    expect(
      within(card).getByText(
        'Would you like to write one of these, or something else?',
      ),
    ).toBeInTheDocument();
    // The user answers in the message box: no options, no "Tell me
    // something else".
    expect(within(card).queryByRole('button')).toBeNull();
    expect(within(card).queryByRole('textbox')).toBeNull();
  });

  it.each([
    [
      'A CODEOWNERS file exists',
      'Make a check on this instead: a CODEOWNERS file exists',
    ],
    ['Must have a README', 'I mean: must have a README'],
  ])('a click on "%s" sends "%s"', async (name, sent) => {
    const onAction = jest.fn();
    render(<AgentUi messages={[noticeCards.noFact]} onAction={onAction} />);

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name }));
    });

    await waitFor(() =>
      expect(onAction).toHaveBeenCalledWith(
        sent,
        expect.objectContaining({ name: expect.any(String) }),
      ),
    );
  });

  it('offers the covered kind instead', async () => {
    const onAction = jest.fn();
    render(<AgentUi messages={[noticeCards.noKind]} onAction={onAction} />);

    const card = await screen.findByRole('group', {
      name: "Can't check this for APIs",
    });
    expect(card.textContent).toMatch(/only collected for Components/);
    await act(async () => {
      fireEvent.click(
        within(card).getByRole('button', { name: 'Check Components instead' }),
      );
    });
    await waitFor(() =>
      expect(onAction).toHaveBeenCalledWith(
        'Yes, check Components instead',
        expect.objectContaining({ name: expect.any(String) }),
      ),
    );
  });

  it('can not be answered once a newer message follows', async () => {
    const onAction = jest.fn();
    render(
      <AgentUi messages={[noticeCards.noFact]} disabled onAction={onAction} />,
    );

    const pick = await screen.findByRole('button', {
      name: 'A CODEOWNERS file exists',
    });
    expect(pick).toBeDisabled();
    await act(async () => {
      fireEvent.click(pick);
    });
    expect(onAction).not.toHaveBeenCalled();
  });

  it('sends what is typed in its box', async () => {
    const onAction = jest.fn();
    render(
      <AgentUi
        messages={[
          withAnswer(noticeCards.noFact, 'Or describe a different check'),
        ]}
        onAction={onAction}
      />,
    );

    const card = await screen.findByRole('group', {
      name: "Can't build this check yet",
    });
    const box = within(card).getByRole('textbox', { name: 'Your answer' });
    expect(box).toHaveAttribute('placeholder', 'Or describe a different check');
    await act(async () => {
      fireEvent.change(box, { target: { value: 'Repos must have a license' } });
    });
    await act(async () => {
      fireEvent.click(within(card).getByRole('button', { name: 'Send' }));
    });

    await waitFor(() =>
      expect(onAction).toHaveBeenCalledWith(
        'Repos must have a license',
        expect.objectContaining({ name: expect.any(String) }),
      ),
    );
  });

  it('has no box when the agent sends none', async () => {
    render(<AgentUi messages={[noticeCards.noFact]} onAction={jest.fn()} />);

    const card = await screen.findByRole('group', {
      name: "Can't build this check yet",
    });
    expect(within(card).queryByRole('textbox')).toBeNull();
  });

  it('replaces the reply text', () => {
    expect(hasReplyCard([noticeCards.noFact])).toBe(true);
  });
});
