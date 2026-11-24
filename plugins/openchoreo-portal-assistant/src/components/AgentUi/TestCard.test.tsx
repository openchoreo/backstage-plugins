import { render, screen, within } from '@testing-library/react';
import { AgentUi, hasReplyCard } from './AgentUi';
import { testCards } from './changeCards.fixture';

describe('TestCard', () => {
  it('shows a failed test with what the rule needs and what the component has', async () => {
    render(<AgentUi messages={[testCards.failed]} onAction={jest.fn()} />);

    const card = await screen.findByRole('group', {
      name: 'Test on order-api: Failed',
    });
    expect(within(card).getByText('Failed')).toBeInTheDocument();
    expect(within(card).getByText('Component')).toBeInTheDocument();
    expect(
      within(card).getByText("order-api doesn't meet this rule."),
    ).toBeInTheDocument();
    expect(within(card).getByText('What the rule needs')).toBeInTheDocument();
    expect(within(card).getByText('2 or more')).toBeInTheDocument();
    expect(within(card).getByText('What order-api has')).toBeInTheDocument();
    expect(within(card).getByText('1')).toBeInTheDocument();
    expect(card.textContent).not.toMatch(/github/);
    expect(within(card).queryByRole('button')).toBeNull();
  });

  it("says why a check doesn't apply", async () => {
    render(
      <AgentUi messages={[testCards.notApplicable]} onAction={jest.fn()} />,
    );

    const card = await screen.findByRole('group', {
      name: "Test on order-api: Doesn't apply",
    });
    expect(
      within(card).getByText(
        "This check doesn't apply to order-api. The component names no GitHub repository.",
      ),
    ).toBeInTheDocument();
  });

  it('replaces the reply text', () => {
    expect(hasReplyCard([testCards.failed])).toBe(true);
  });
});
