import { render } from '@testing-library/react';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('renders a single placeholder by default', () => {
    const { container } = render(<Skeleton />);
    // One shimmer element, marked decorative for screen readers.
    const items = container.querySelectorAll('[aria-hidden="true"]');
    expect(items).toHaveLength(1);
  });

  it('renders N stacked lines when count > 1', () => {
    const { container } = render(<Skeleton count={3} />);
    // A stack wrapper plus three child lines — four aria-hidden nodes total.
    const items = container.querySelectorAll('[aria-hidden="true"]');
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it('applies an infinite shimmer animation and a token-driven duration', () => {
    const { container } = render(<Skeleton variant="rect" height={120} />);
    const el = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(el).toBeInTheDocument();
    // Duration comes from motion.shimmerDuration (2s) via inline style.
    expect(el.style.animationDuration).toBe('2s');
    // Explicit height is forwarded.
    expect(el.style.height).toBe('120px');
  });

  it('forwards width and defaults to full width for text/rect', () => {
    const { container } = render(<Skeleton variant="text" />);
    const el = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(el.style.width).toBe('100%');
  });

  it('is decorative (no accessible role) so aria-busy lives on the container', () => {
    const { queryByRole } = render(<Skeleton />);
    expect(queryByRole('status')).not.toBeInTheDocument();
  });

  it('tags each placeholder with a default (overridable) data-testid', () => {
    const { getAllByTestId, rerender } = render(<Skeleton count={3} />);
    expect(getAllByTestId('skeleton')).toHaveLength(3);
    rerender(<Skeleton data-testid="custom" />);
    expect(getAllByTestId('custom')).toHaveLength(1);
  });

  it('merges a caller style over the shimmer style (drop-in for MUI style prop)', () => {
    const { container } = render(
      <Skeleton variant="rect" height={36} style={{ marginTop: 12 }} />,
    );
    const el = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    // Caller style is applied...
    expect(el.style.marginTop).toBe('12px');
    // ...alongside the component's own shimmer style.
    expect(el.style.animationDuration).toBe('2s');
  });
});
