import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { AgentUi, hasReplyCard } from './AgentUi';
import { askCards } from './changeCards.fixture';

const renderCard = async (
  card: unknown,
  name: string,
  { disabled = false } = {},
) => {
  const onAction = jest.fn();
  render(<AgentUi messages={[card]} disabled={disabled} onAction={onAction} />);
  const group = await screen.findByRole('group', { name });
  return { onAction, card: group };
};

const click = async (element: HTMLElement) => {
  await act(async () => {
    fireEvent.click(element);
  });
};

const reviews = 'Approving reviews required before merging';

describe('AskCard after "No, keep it"', () => {
  const open = () => renderCard(askCards.afterNo, 'What should change?');

  it('shows the rule in plain words with an editor per value', async () => {
    const { card } = await open();

    expect(
      within(card).getByText(
        'You rejected changing the required approvals from 3 to 2.',
      ),
    ).toBeInTheDocument();
    expect(within(card).getByText('Current rule')).toBeInTheDocument();
    expect(within(card).getByText('3 or more')).toBeInTheDocument();
    expect(within(card).getByText('Change a value')).toBeInTheDocument();
    const editor = within(card).getByRole('group', { name: reviews });
    expect(within(editor).getByRole('spinbutton')).toHaveValue(3);
    expect(within(editor).getByRole('combobox')).toHaveValue('at least');
    // No technical fact names, and no Yes / No to an open question.
    expect(card.textContent).not.toMatch(/github/);
    expect(
      within(card).queryByRole('button', { name: /Yes, change it/ }),
    ).not.toBeInTheDocument();
  });

  it('sends the new number once it changes', async () => {
    const { card, onAction } = await open();
    const editor = within(card).getByRole('group', { name: reviews });
    const send = within(card).getByRole('button', { name: 'Send' });

    expect(send).toBeDisabled();
    await click(within(editor).getByRole('button', { name: 'More' }));
    expect(send).toBeEnabled();
    await click(send);

    await waitFor(() =>
      expect(onAction).toHaveBeenCalledWith(
        'Change approving reviews required before merging to at least 4',
        expect.objectContaining({ name: expect.any(String) }),
      ),
    );
  });

  it('sends a changed comparison', async () => {
    const { card, onAction } = await open();
    const editor = within(card).getByRole('group', { name: reviews });

    await act(async () => {
      fireEvent.change(within(editor).getByRole('combobox'), {
        target: { value: 'more than' },
      });
    });
    await click(within(card).getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(onAction).toHaveBeenCalledWith(
        'Change approving reviews required before merging to more than 3',
        expect.objectContaining({ name: expect.any(String) }),
      ),
    );
  });

  it('sends a yes / no value', async () => {
    const { card, onAction } = await open();
    const editor = within(card).getByRole('group', {
      name: 'Branch protected',
    });

    await click(within(editor).getByRole('button', { name: 'No' }));
    expect(within(editor).getByRole('button', { name: 'No' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await click(within(card).getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(onAction).toHaveBeenCalledWith(
        'Change branch protected to No',
        expect.objectContaining({ name: expect.any(String) }),
      ),
    );
  });

  it('removes a condition when Send is pressed', async () => {
    const { card, onAction } = await open();
    const editor = within(card).getByRole('group', {
      name: 'Branch protected',
    });
    const send = within(card).getByRole('button', { name: 'Send' });

    await click(within(editor).getByRole('button', { name: 'Remove' }));
    expect(onAction).not.toHaveBeenCalled();
    expect(within(editor).getByRole('button', { name: 'No' })).toBeDisabled();
    expect(send).toBeEnabled();
    await click(send);

    await waitFor(() =>
      expect(onAction).toHaveBeenCalledWith(
        'Remove the condition: branch protected',
        expect.objectContaining({ name: expect.any(String) }),
      ),
    );
  });

  it('keeps a removed condition when Keep is pressed', async () => {
    const { card } = await open();
    const editor = within(card).getByRole('group', {
      name: 'Branch protected',
    });

    await click(within(editor).getByRole('button', { name: 'Remove' }));
    await click(within(editor).getByRole('button', { name: 'Keep' }));

    expect(
      within(editor).getByRole('button', { name: 'Remove' }),
    ).toBeEnabled();
    expect(within(editor).getByRole('button', { name: 'No' })).toBeEnabled();
    expect(within(card).getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('sends a removal with the other changes, in card order', async () => {
    const { card, onAction } = await open();
    const branch = within(card).getByRole('group', {
      name: 'Branch protected',
    });
    const editor = within(card).getByRole('group', { name: reviews });

    await click(within(editor).getByRole('button', { name: 'More' }));
    await click(within(branch).getByRole('button', { name: 'Remove' }));
    await click(within(card).getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(onAction).toHaveBeenCalledTimes(1));
    expect(onAction).toHaveBeenCalledWith(
      'Remove the condition: branch protected. ' +
        'Change approving reviews required before merging to at least 4',
      expect.objectContaining({ name: expect.any(String) }),
    );
  });

  it('sends every change and what is typed as one message', async () => {
    const { card, onAction } = await open();
    const branch = within(card).getByRole('group', {
      name: 'Branch protected',
    });
    const editor = within(card).getByRole('group', { name: reviews });

    // Changed bottom-up: the message still follows the card's order.
    await click(within(editor).getByRole('button', { name: 'More' }));
    await click(within(branch).getByRole('button', { name: 'No' }));
    await act(async () => {
      fireEvent.change(
        within(card).getByRole('textbox', { name: 'Your answer' }),
        { target: { value: 'also require code owner review' } },
      );
    });
    await click(within(card).getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(onAction).toHaveBeenCalledTimes(1));
    expect(onAction).toHaveBeenCalledWith(
      'Change branch protected to No. ' +
        'Change approving reviews required before merging to at least 4. ' +
        'also require code owner review',
      expect.objectContaining({ name: expect.any(String) }),
    );
  });

  it('sends what is typed', async () => {
    const { card, onAction } = await open();
    const box = within(card).getByRole('textbox', {
      name: 'Your answer',
    });
    const send = within(card).getByRole('button', { name: 'Send' });

    expect(box).toHaveAttribute('placeholder', 'Or type it, e.g. "make it 4"');
    expect(send).toBeDisabled();
    await act(async () => {
      fireEvent.change(box, { target: { value: '  make it 5 ' } });
    });
    await click(send);

    await waitFor(() =>
      expect(onAction).toHaveBeenCalledWith(
        'make it 5',
        expect.objectContaining({ name: expect.any(String) }),
      ),
    );
  });

  it('keeps the rule', async () => {
    const { card, onAction } = await open();

    await click(
      within(card).getByRole('button', { name: 'Keep the current rule' }),
    );

    await waitFor(() =>
      expect(onAction).toHaveBeenCalledWith(
        'Keep the rule as it is',
        expect.objectContaining({ name: expect.any(String) }),
      ),
    );
  });

  it('can not be answered once a newer message follows', async () => {
    const { card, onAction } = await renderCard(
      askCards.afterNo,
      'What should change?',
      { disabled: true },
    );

    for (const name of ['More', 'Remove', 'Keep the current rule']) {
      for (const button of within(card).getAllByRole('button', { name })) {
        expect(button).toBeDisabled();
      }
    }
    expect(
      within(card).getByRole('textbox', { name: 'Your answer' }),
    ).toBeDisabled();
    await click(
      within(card).getByRole('button', { name: 'Keep the current rule' }),
    );
    expect(onAction).not.toHaveBeenCalled();
  });

  it('replaces the reply text', () => {
    expect(hasReplyCard([askCards.afterNo])).toBe(true);
    expect(hasReplyCard([askCards.whichOption])).toBe(true);
  });
});

describe('AskCard for options in words', () => {
  const open = () =>
    renderCard(askCards.whichOption, 'Which change do you mean?');

  it('shows one option each, without the "Reply with" line', async () => {
    const { card } = await open();

    expect(within(card).queryByText('Pick one')).toBeNull();
    expect(
      within(card).getByRole('button', {
        name: 'Option 1: Change the required approving reviews from 3 to 2 (so 2 or more approvals pass)',
      }),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole('button', {
        name: 'Option 4: Remove the approvals requirement entirely',
      }),
    ).toBeInTheDocument();
    expect(card.textContent).not.toMatch(/Reply with/);
  });

  it('a click on an option sends its words', async () => {
    const { card, onAction } = await open();

    await click(
      within(card).getByRole('button', {
        name: 'Option 2: Require more than 2 approvals (so 3 or more approvals pass)',
      }),
    );

    await waitFor(() =>
      expect(onAction).toHaveBeenCalledWith(
        'Require more than 2 approvals (so 3 or more approvals pass)',
        expect.objectContaining({ name: expect.any(String) }),
      ),
    );
  });

  it('the number option sends the number picked', async () => {
    const { card, onAction } = await open();
    const option = within(card).getByRole('group', {
      name: 'Option 3: A different number',
    });

    expect(within(option).getByRole('spinbutton')).toHaveValue(3);
    await click(within(option).getByRole('button', { name: 'More' }));
    await click(within(option).getByRole('button', { name: 'More' }));
    await click(
      within(option).getByRole('button', { name: 'Use this number' }),
    );

    await waitFor(() =>
      expect(onAction).toHaveBeenCalledWith(
        'A different number: 5',
        expect.objectContaining({ name: expect.any(String) }),
      ),
    );
  });

  it('keeps the current rule from the footer', async () => {
    const { card, onAction } = await open();

    await click(
      within(card).getByRole('button', { name: 'Keep the current rule' }),
    );

    await waitFor(() =>
      expect(onAction).toHaveBeenCalledWith(
        'Keep the rule as it is',
        expect.objectContaining({ name: expect.any(String) }),
      ),
    );
  });
});

describe('AskCard with the drawer’s message box', () => {
  const open = async () => {
    const composer = { write: jest.fn(), focus: jest.fn() };
    const onAction = jest.fn();
    render(
      <AgentUi
        messages={[askCards.afterNo]}
        onAction={onAction}
        composer={composer}
      />,
    );
    const card = await screen.findByRole('group', {
      name: 'What should change?',
    });
    return { card, composer, onAction };
  };

  it('writes a changed value there instead of sending it', async () => {
    const { card, composer, onAction } = await open();
    expect(composer.write).not.toHaveBeenCalled();

    const editor = within(card).getByRole('group', {
      name: 'Branch protected',
    });
    await click(within(editor).getByRole('button', { name: 'No' }));

    expect(composer.write).toHaveBeenLastCalledWith(
      'Change branch protected to No',
    );
    expect(onAction).not.toHaveBeenCalled();
  });

  it('has no box or Send of its own, only "Tell me something else"', async () => {
    const { card, composer } = await open();

    expect(within(card).queryByRole('textbox')).toBeNull();
    expect(within(card).queryByRole('button', { name: 'Send' })).toBeNull();
    await click(
      within(card).getByRole('button', { name: 'Tell me something else' }),
    );

    expect(composer.focus).toHaveBeenCalledWith(expect.stringMatching(/^Or /));
  });

  // "Which change do you mean?" with only its first option.
  const oneOption = {
    ...askCards.whichOption,
    createSurface: {
      ...askCards.whichOption.createSurface,
      components: askCards.whichOption.createSurface.components
        .filter(
          (c: any) => !['option_2', 'option_3', 'option_4'].includes(c.id),
        )
        .map((c: any) =>
          c.id === 'root' ? { ...c, options: ['option_1'] } : c,
        ),
    },
  };

  const openOptions = (message: unknown) => {
    render(
      <AgentUi
        messages={[message]}
        onAction={jest.fn()}
        composer={{ write: jest.fn(), focus: jest.fn() }}
      />,
    );
    return screen.findByRole('group', { name: 'Which change do you mean?' });
  };

  it('shows no "Pick one" above two or more options', async () => {
    // 2026-11-25: no label above the options, whatever their number.
    const card = await openOptions(askCards.whichOption);

    expect(within(card).queryByText('Pick one')).toBeNull();
    expect(
      within(card).getByRole('button', { name: /^Option 4:/ }),
    ).toBeInTheDocument();
  });

  it('shows no "Pick one" above one option', async () => {
    const card = await openOptions(oneOption);

    expect(within(card).queryByText('Pick one')).toBeNull();
    expect(
      within(card).getByRole('button', { name: /^Option 1:/ }),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole('button', { name: 'Tell me something else' }),
    ).toBeInTheDocument();
  });
});
