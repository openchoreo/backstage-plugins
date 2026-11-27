import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { AgentUi, hasReplyCard } from './AgentUi';
import { replyCards } from './changeCards.fixture';

const click = async (element: HTMLElement) => {
  await act(async () => {
    fireEvent.click(element);
  });
};

describe('ReplyCard', () => {
  it('shows an answer with its sections in plain words', async () => {
    render(<AgentUi messages={[replyCards.answer]} onAction={jest.fn()} />);

    const card = await screen.findByRole('group', {
      name: 'What this check does',
    });
    expect(
      within(card).getByText(
        'Main branch must be protected and require 2 approvals',
      ),
    ).toBeInTheDocument();
    expect(
      within(card).getByText(/It passes when the main branch is protected/),
    ).toBeInTheDocument();
    expect(within(card).getByText('What it checks')).toBeInTheDocument();
    expect(
      within(card).getByText('Approving reviews required'),
    ).toBeInTheDocument();
    expect(within(card).getByText('2 or more')).toBeInTheDocument();
    expect(within(card).queryByRole('button')).toBeNull();
  });

  it('highlights the question it asks', async () => {
    render(<AgentUi messages={[replyCards.question]} onAction={jest.fn()} />);

    const card = await screen.findByRole('group', {
      name: 'Which entity kind?',
    });
    expect(within(card).getByText('Which kind should it run on?').tagName).toBe(
      'SPAN',
    );
  });

  it.each([
    [
      'a line after it',
      'A check has three parts. Do you need more help, or shall I draft it? Tell me below.',
      'Do you need more help, or shall I draft it? Tell me below.',
    ],
    [
      'only a question',
      'Which kind should it run on?',
      'Which kind should it run on?',
    ],
  ])('highlights a question with %s', async (_name, summary, question) => {
    const card = replyCards.question as any;
    const message = {
      ...card,
      createSurface: {
        ...card.createSurface,
        components: card.createSurface.components.map((c: any) =>
          c.id === 'root' ? { ...c, summary } : c,
        ),
      },
    };
    render(<AgentUi messages={[message]} onAction={jest.fn()} />);

    const group = await screen.findByRole('group', {
      name: 'Which entity kind?',
    });
    const found = within(group).getByText(question);
    expect(found.tagName).toBe('SPAN');
  });

  it('asks its question after an explanation in sections', async () => {
    const [root, ...rest] = replyCards.answer.createSurface.components;
    const explained = {
      ...replyCards.answer,
      createSurface: {
        ...replyCards.answer.createSurface,
        components: [
          { ...root, summary: `${root.summary} Want to change anything?` },
          ...rest,
        ],
      },
    };
    render(<AgentUi messages={[explained]} onAction={jest.fn()} />);

    const card = await screen.findByRole('group', {
      name: 'What this check does',
    });
    const question = within(card).getByText('Want to change anything?');
    const lastLine = within(card).getByText('Approving reviews required');
    // Read after the sections, not in the summary above them.
    expect(
      lastLine.compareDocumentPosition(question) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      within(card).getByText(/^It passes when the main branch is protected/),
    ).not.toContainElement(question);
  });

  it('asks a question with a line after it below the facts, in blue', async () => {
    const [root, ...rest] = replyCards.answer.createSurface.components;
    const facts = {
      ...replyCards.answer,
      createSurface: {
        ...replyCards.answer.createSurface,
        components: [
          {
            ...root,
            summary:
              'These are the facts you can use for code access. Do you have a rule in mind? Tell me in your own words.',
          },
          ...rest,
        ],
      },
    };
    render(<AgentUi messages={[facts]} onAction={jest.fn()} />);

    const card = await screen.findByRole('group', {
      name: 'What this check does',
    });
    const question = within(card).getByText(
      'Do you have a rule in mind? Tell me in your own words.',
    );
    const lastLine = within(card).getByText('Approving reviews required');
    expect(question.tagName).toBe('SPAN');
    expect(
      lastLine.compareDocumentPosition(question) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('sends the sentence of the answer clicked', async () => {
    const onAction = jest.fn();
    render(<AgentUi messages={[replyCards.question]} onAction={onAction} />);

    const card = await screen.findByRole('group', {
      name: 'Which entity kind?',
    });
    expect(within(card).queryByText('Pick one')).toBeNull();
    await click(within(card).getByRole('button', { name: 'APIs' }));

    await waitFor(() =>
      expect(onAction).toHaveBeenCalledWith(
        'Run it on APIs',
        expect.objectContaining({ name: expect.any(String) }),
      ),
    );
  });

  it('sends what is typed', async () => {
    const onAction = jest.fn();
    render(<AgentUi messages={[replyCards.question]} onAction={onAction} />);

    const card = await screen.findByRole('group', {
      name: 'Which entity kind?',
    });
    const box = within(card).getByRole('textbox', {
      name: 'Your answer',
    });
    expect(box).toHaveAttribute('placeholder', 'Or type another kind');
    await act(async () => {
      fireEvent.change(box, { target: { value: 'Systems' } });
    });
    await click(within(card).getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(onAction).toHaveBeenCalledWith(
        'Systems',
        expect.objectContaining({ name: expect.any(String) }),
      ),
    );
  });

  it('can not be answered once a newer message follows', async () => {
    const onAction = jest.fn();
    render(
      <AgentUi messages={[replyCards.question]} disabled onAction={onAction} />,
    );

    const card = await screen.findByRole('group', {
      name: 'Which entity kind?',
    });
    const pick = within(card).getByRole('button', { name: 'Components' });
    expect(pick).toBeDisabled();
    await click(pick);
    expect(onAction).not.toHaveBeenCalled();
  });

  it('puts every value under its label, so short and long lines line up', async () => {
    render(<AgentUi messages={[replyCards.longValues]} onAction={jest.fn()} />);

    const card = await screen.findByRole('group', {
      name: 'README file check',
    });
    const label = within(card).getByText('CODEOWNERS');
    const value = within(card).getByText(
      'Whether the evaluated branch has a CODEOWNERS file in .github/, the root or docs/',
    );
    // Label above value, one under the other; the value may break lines.
    expect(getComputedStyle(label.parentElement!).display).toBe('grid');
    expect(label.parentElement).toBe(value.parentElement);
    expect(getComputedStyle(value).whiteSpace).not.toBe('nowrap');
  });

  it('replaces the reply text', () => {
    expect(hasReplyCard([replyCards.answer])).toBe(true);
    expect(hasReplyCard([replyCards.question])).toBe(true);
  });
});

describe('ReplyCard suggestions with the drawer’s message box', () => {
  const suggestions = {
    version: '1.0',
    createSurface: {
      surfaceId: 'reply-ideas',
      catalogId: 'openchoreo.dev:portal-assistant/v1',
      components: [
        {
          id: 'root',
          component: 'ReplyCard',
          title: 'Ways to improve this check',
          summary: 'It only asks for branch protection.',
          sections: [],
          choices: ['choice_0', 'choice_1'],
          answer: ['answer'],
        },
        ...[
          ['Require 2 approvals', 'Also require 2 approving reviews'],
          ['Require status checks', 'Also require status checks'],
        ].map(([label, text], i) => ({
          id: `choice_${i}`,
          component: 'PickRow',
          label,
          text,
          action: { event: { name: 'pick_choice', userMessage: text } },
        })),
        {
          id: 'answer',
          component: 'AskField',
          placeholder: 'Or type your own',
          value: { '@path': '/reply/text' },
          action: {
            event: {
              name: 'type_answer',
              userMessage: { '@path': '/reply/text' },
            },
          },
        },
      ],
    },
  };

  // The same card with only its first suggestion.
  const oneSuggestion = {
    ...suggestions,
    createSurface: {
      ...suggestions.createSurface,
      components: suggestions.createSurface.components
        .filter((c: any) => c.id !== 'choice_1')
        .map((c: any) =>
          c.id === 'root' ? { ...c, choices: ['choice_0'] } : c,
        ),
    },
  };

  // withComposer false: no message box, as in chats other than check
  // authoring.
  const open = async (message: unknown = suggestions, withComposer = true) => {
    const composer = { write: jest.fn(), focus: jest.fn() };
    const onAction = jest.fn();
    render(
      <AgentUi
        messages={[message]}
        onAction={onAction}
        composer={withComposer ? composer : undefined}
      />,
    );
    const card = await screen.findByRole('group', {
      name: 'Ways to improve this check',
    });
    return { card, composer, onAction };
  };

  it('sends a suggestion at once when clicked, with an arrow', async () => {
    const { card, composer, onAction } = await open();

    await click(
      within(card).getByRole('button', { name: 'Require 2 approvals' }),
    );

    await waitFor(() =>
      expect(onAction).toHaveBeenCalledWith(
        'Also require 2 approving reviews',
        expect.objectContaining({ name: expect.any(String) }),
      ),
    );
    expect(composer.write).not.toHaveBeenCalled();
    expect(within(card).queryByRole('radio')).toBeNull();
    expect(
      within(card).getByRole('button', { name: 'Tell me something else' }),
    ).toBeInTheDocument();
  });

  it('shows no "Pick one" above two or more suggestions', async () => {
    // 2026-11-25: no label above the options, whatever their number.
    const { card } = await open();

    expect(within(card).queryByText('Pick one')).toBeNull();
    expect(
      within(card).getByRole('button', { name: 'Require status checks' }),
    ).toBeInTheDocument();
  });

  it('shows no "Pick one" above one suggestion', async () => {
    const { card } = await open(oneSuggestion);

    expect(within(card).queryByText('Pick one')).toBeNull();
    expect(
      within(card).getByRole('button', { name: 'Require 2 approvals' }),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole('button', { name: 'Tell me something else' }),
    ).toBeInTheDocument();
  });

  it('shows no "Pick one" without the message box either', async () => {
    const { card } = await open(oneSuggestion, false);

    expect(within(card).queryByText('Pick one')).toBeNull();
  });

  it('lists areas by name only, with the question under them and nothing to click', async () => {
    // 2026-11-25: a familiar user's areas are a plain answer.
    const areas = {
      version: '1.0',
      createSurface: {
        surfaceId: 'reply-areas',
        catalogId: 'openchoreo.dev:portal-assistant/v1',
        components: [
          {
            id: 'root',
            component: 'ReplyCard',
            title: 'Areas you can check',
            summary:
              'Here are some areas. Would you like to pick one of these areas?',
            sections: ['section_0'],
            choices: [],
            answer: [],
          },
          {
            id: 'section_0',
            component: 'ReplySection',
            label: 'Areas',
            lines: ['line_0_0', 'line_0_1'],
          },
          ...['Code access', 'Code scanning'].map((value, i) => ({
            id: `line_0_${i}`,
            component: 'ReplyLine',
            label: '',
            value,
          })),
        ],
      },
    };
    render(
      <AgentUi
        messages={[areas]}
        onAction={jest.fn()}
        composer={{ write: jest.fn(), focus: jest.fn() }}
      />,
    );
    const card = await screen.findByRole('group', {
      name: 'Areas you can check',
    });

    const last = within(card).getByText('Code scanning');
    const question = within(card).getByText(
      'Would you like to pick one of these areas?',
    );
    expect(within(card).getByText('Code access')).toBeInTheDocument();
    // Just the name: no empty label above it.
    expect(last.parentElement?.childElementCount).toBe(1);
    expect(
      last.compareDocumentPosition(question) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(card).queryByRole('button')).toBeNull();
  });
});
