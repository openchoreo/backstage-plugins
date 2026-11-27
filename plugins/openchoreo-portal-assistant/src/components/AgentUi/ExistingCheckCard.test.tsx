import { fireEvent, render, screen, within } from '@testing-library/react';
import { AgentUi, hasReplyCard } from './AgentUi';
import { existingCheckCards } from './changeCards.fixture';

describe('ExistingCheckCard', () => {
  it('says what was found and why, with the rule in plain words', async () => {
    render(
      <AgentUi
        messages={[existingCheckCards.same]}
        onAction={jest.fn()}
        onOpenCheck={jest.fn()}
      />,
    );

    const card = await screen.findByRole('group', {
      name: 'This check already exists',
    });
    expect(
      within(card).getByText('Branch protection · Published'),
    ).toBeInTheDocument();
    expect(within(card).getByText(/it's in every score/)).toBeInTheDocument();
    expect(within(card).getByText('What it checks')).toBeInTheDocument();
    expect(within(card).getByText('2 or more')).toBeInTheDocument();
    // The same rule: nothing new to show.
    expect(within(card).queryByText('Your new rule')).toBeNull();
    expect(
      within(card).getByText(
        'Would you like to edit it, or create a separate check?',
      ),
    ).toBeInTheDocument();
    expect(
      within(card)
        .getAllByRole('button')
        .map(button => button.textContent),
    ).toEqual(['Edit this check', 'Create a separate check']);
    // It replaces the reply's text, like the other cards.
    expect(hasReplyCard([existingCheckCards.same])).toBe(true);
  });

  it('shows both rules when they differ', async () => {
    render(
      <AgentUi
        messages={[existingCheckCards.similar]}
        onAction={jest.fn()}
        onOpenCheck={jest.fn()}
      />,
    );

    const card = await screen.findByRole('group', {
      name: 'A similar draft exists',
    });
    expect(within(card).getByText('What it checks now')).toBeInTheDocument();
    expect(within(card).getByText('1 or more')).toBeInTheDocument();
    expect(within(card).getByText('Your new rule')).toBeInTheDocument();
    expect(within(card).getByText('2 or more')).toBeInTheDocument();
  });

  it.each([
    ['same', 'Edit this check', undefined],
    [
      'similar',
      'Change it to my rule',
      'Change this check to my new rule (Default branch protected: Yes, Approving reviews required: 2 or more)',
    ],
  ] as const)(
    'moves the chat to the %s check, with the change to make',
    async (kind, label, message) => {
      const onOpenCheck = jest.fn();
      const onAction = jest.fn();
      render(
        <AgentUi
          messages={[existingCheckCards[kind]]}
          onAction={onAction}
          onOpenCheck={onOpenCheck}
        />,
      );

      fireEvent.click(await screen.findByRole('button', { name: label }));

      const root = existingCheckCards[kind].createSurface.components[0] as {
        check: unknown;
      };
      expect(onOpenCheck).toHaveBeenCalledWith(root.check, message);
      expect(onAction).not.toHaveBeenCalled();
    },
  );

  it('sends "Create a separate check" as the next message', async () => {
    const onAction = jest.fn();
    const onOpenCheck = jest.fn();
    render(
      <AgentUi
        messages={[existingCheckCards.same]}
        onAction={onAction}
        onOpenCheck={onOpenCheck}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Create a separate check' }),
    );

    expect(onAction).toHaveBeenCalledWith(
      'Create a separate check instead of editing Branch protection',
      expect.objectContaining({ name: expect.any(String) }),
    );
    expect(onOpenCheck).not.toHaveBeenCalled();
  });

  it("can't be answered once the chat moved on", async () => {
    render(
      <AgentUi
        messages={[existingCheckCards.same]}
        disabled
        onAction={jest.fn()}
        onOpenCheck={jest.fn()}
      />,
    );

    const card = await screen.findByRole('group', {
      name: 'This check already exists',
    });
    for (const button of within(card).getAllByRole('button')) {
      expect(button).toBeDisabled();
    }
  });
});
