import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it.each([
    ['success', 'Success'],
    ['error', 'Error'],
    ['pending', 'Pending'],
    ['active', 'Active'],
    ['not-deployed', 'Not Deployed'],
  ] as const)('renders default label "%s" → "%s"', (status, expectedLabel) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(expectedLabel)).toBeInTheDocument();
  });

  it('uses custom label when provided', () => {
    render(<StatusBadge status="success" label="All Good" />);
    expect(screen.getByText('All Good')).toBeInTheDocument();
    expect(screen.queryByText('Success')).not.toBeInTheDocument();
  });

  it('renders dot by default (showDot=true)', () => {
    const { container } = render(<StatusBadge status="success" />);
    const dot = container.querySelector('span');
    expect(dot).toBeInTheDocument();
  });

  it('hides dot when showDot is false', () => {
    const { container } = render(
      <StatusBadge status="success" showDot={false} />,
    );
    // The only span should be the Typography span with the label text
    const spans = container.querySelectorAll('span');
    const dotSpans = Array.from(spans).filter(
      s => s.textContent === '' || !s.textContent,
    );
    expect(dotSpans).toHaveLength(0);
  });
});
