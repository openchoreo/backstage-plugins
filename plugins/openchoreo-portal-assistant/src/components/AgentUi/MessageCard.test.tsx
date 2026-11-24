import { render, screen, within } from '@testing-library/react';
import { AgentUi, hasReplyCard } from './AgentUi';
import { messageCards } from './changeCards.fixture';

const text = messageCards.answer.createSurface.components[0].text as string;

describe('MessageCard', () => {
  it('shows the reply text in the card', async () => {
    render(<AgentUi messages={[messageCards.answer]} onAction={jest.fn()} />);

    const card = await screen.findByRole('group', { name: 'Reply' });
    expect(card.textContent).toBe(text);
  });

  it("renders the text with the drawer's Markdown renderer", async () => {
    render(
      <AgentUi
        messages={[messageCards.answer]}
        onAction={jest.fn()}
        renderMarkdown={markdown => (
          <div data-testid="markdown">{markdown.replace(/\*\*/g, '')}</div>
        )}
      />,
    );

    const card = await screen.findByRole('group', { name: 'Reply' });
    expect(within(card).getByTestId('markdown').textContent).toMatch(
      /^This check passes when the main branch is protected/,
    );
  });

  it('has no buttons', async () => {
    render(<AgentUi messages={[messageCards.answer]} onAction={jest.fn()} />);

    const card = await screen.findByRole('group', { name: 'Reply' });
    expect(within(card).queryByRole('button')).toBeNull();
  });

  it('replaces the reply text', () => {
    expect(hasReplyCard([messageCards.answer])).toBe(true);
  });
});
