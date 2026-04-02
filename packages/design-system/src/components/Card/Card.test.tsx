import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  it('renders children', () => {
    render(
      <Card>
        <div>Card content</div>
      </Card>,
    );
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('renders with custom className', () => {
    const { container } = render(
      <Card className="my-custom-class">
        <div>Content</div>
      </Card>,
    );

    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('my-custom-class');
  });

  it('adds interactive class when interactive prop is true', () => {
    const { container, rerender } = render(
      <Card>
        <div>Content</div>
      </Card>,
    );

    const cardDefault = container.firstChild as HTMLElement;
    const defaultClasses = cardDefault.className;

    rerender(
      <Card interactive>
        <div>Content</div>
      </Card>,
    );

    const cardInteractive = container.firstChild as HTMLElement;
    // Interactive card should have additional class(es) compared to non-interactive
    expect(cardInteractive.className).not.toEqual(defaultClasses);
    expect(cardInteractive.className.length).toBeGreaterThan(
      defaultClasses.length,
    );
  });
});
