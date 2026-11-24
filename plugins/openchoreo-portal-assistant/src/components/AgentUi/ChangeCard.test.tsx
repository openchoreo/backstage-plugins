import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { AgentUi, hasReplyCard } from './AgentUi';
import { changeCards, withAnswer } from './changeCards.fixture';

describe('ChangeCard', () => {
  it('shows the sentence, the current rule and the change in plain words', async () => {
    render(<AgentUi messages={[changeCards.one]} onAction={jest.fn()} />);

    const card = await screen.findByRole('group', { name: 'Proposed change' });
    expect(
      within(card).getByText(
        'Main branch must be protected and require 2 approvals',
      ),
    ).toBeInTheDocument();
    expect(
      within(card).getByText(
        'You want to raise the required approving reviews from 2 to 3.',
      ),
    ).toBeInTheDocument();
    expect(within(card).getByText('Current rule')).toBeInTheDocument();
    expect(within(card).getByText('Branch protected')).toBeInTheDocument();
    expect(within(card).getByText('Yes')).toBeInTheDocument();
    expect(within(card).getByText('Change')).toBeInTheDocument();
    // The changed condition: once under Current rule, once under Change.
    expect(
      within(card).getAllByText('Approving reviews required before merging'),
    ).toHaveLength(2);
    expect(within(card).getAllByText('2 or more')).toHaveLength(2);
    expect(within(card).getByText('3 or more')).toBeInTheDocument();
    expect(
      within(card).getByRole('button', { name: 'Yes, change it' }),
    ).toBeEnabled();
    expect(within(card).getByRole('button', { name: 'No' })).toBeEnabled();
    // No technical names on the card.
    expect(card.textContent).not.toMatch(/github|greaterThan/);
  });

  it('shows two choices as small option buttons and sets the question apart', async () => {
    render(<AgentUi messages={[changeCards.two]} onAction={jest.fn()} />);

    const card = await screen.findByRole('group', { name: 'Proposed change' });
    expect(
      within(card).getByText('Should exactly 3 approvals pass?'),
    ).toBeInTheDocument();
    expect(within(card).getByText('choose below')).toBeInTheDocument();
    expect(
      within(card).getByRole('button', { name: 'Option 1: 3 or more' }),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole('button', { name: 'Option 2: More than 3' }),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole('button', { name: 'Keep the current rule' }),
    ).toBeInTheDocument();
    expect(card.textContent).not.toMatch(/passes|fails/);
  });

  it('asks its question below the rule, right above the options', async () => {
    render(<AgentUi messages={[changeCards.two]} onAction={jest.fn()} />);

    const card = await screen.findByRole('group', { name: 'Proposed change' });
    const question = within(card).getByText('Should exactly 3 approvals pass?');
    const rule = within(card).getByText('choose below');
    const option = within(card).getByRole('button', {
      name: 'Option 1: 3 or more',
    });
    expect(
      rule.compareDocumentPosition(question) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      question.compareDocumentPosition(option) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it.each([
    ['Option 1: 3 or more', '1'],
    ['Option 2: More than 3', '2'],
    ['Keep the current rule', 'no'],
  ])('a click on "%s" sends %s', async (name, sent) => {
    const onAction = jest.fn();
    render(<AgentUi messages={[changeCards.two]} onAction={onAction} />);

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name }));
    });

    await waitFor(() => expect(onAction).toHaveBeenCalledWith(sent));
  });

  it('can not pick an option on an old question', async () => {
    const onAction = jest.fn();
    render(
      <AgentUi messages={[changeCards.two]} disabled onAction={onAction} />,
    );

    const option = await screen.findByRole('button', {
      name: 'Option 1: 3 or more',
    });
    expect(option).toBeDisabled();
    await act(async () => {
      fireEvent.click(option);
    });
    expect(onAction).not.toHaveBeenCalled();
  });

  it('sends what is typed in the box under the choices', async () => {
    const onAction = jest.fn();
    render(
      <AgentUi
        messages={[withAnswer(changeCards.two, 'Or type your own answer')]}
        onAction={onAction}
      />,
    );

    const card = await screen.findByRole('group', { name: 'Proposed change' });
    const box = within(card).getByRole('textbox', { name: 'Your answer' });
    // The box comes after the choices.
    expect(
      within(card)
        .getByRole('button', { name: 'Option 2: More than 3' })
        .compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await act(async () => {
      fireEvent.change(box, { target: { value: 'Make it 4' } });
    });
    await act(async () => {
      fireEvent.click(within(card).getByRole('button', { name: 'Send' }));
    });

    await waitFor(() => expect(onAction).toHaveBeenCalledWith('Make it 4'));
  });

  it('gives Yes / No no box', async () => {
    render(<AgentUi messages={[changeCards.one]} onAction={jest.fn()} />);

    const card = await screen.findByRole('group', { name: 'Proposed change' });
    expect(within(card).queryByRole('textbox')).toBeNull();
  });
});

describe('hasReplyCard', () => {
  it('tells a change card from other agent UI', () => {
    expect(hasReplyCard([changeCards.one])).toBe(true);
    expect(hasReplyCard(undefined)).toBe(false);
    expect(
      hasReplyCard([{ createSurface: { components: [{ component: 'Row' }] } }]),
    ).toBe(false);
  });
});
