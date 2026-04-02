import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('renders error message', () => {
    render(<ErrorState message="Something went wrong" />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('retry button calls onRetry', () => {
    const onRetry = jest.fn();
    render(<ErrorState message="Failed to load" onRetry={onRetry} />);

    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not render retry when onRetry not provided', () => {
    render(<ErrorState message="Failed to load" />);

    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });

  it('renders icon by default, hides when showIcon=false', () => {
    const { container, rerender } = render(
      <ErrorState message="Failed to load" />,
    );

    // Icon is rendered by default (MUI ErrorIcon renders an SVG)
    const svgIcons = container.querySelectorAll('svg');
    expect(svgIcons.length).toBeGreaterThan(0);

    rerender(<ErrorState message="Failed to load" showIcon={false} />);

    const svgIconsAfter = container.querySelectorAll('svg');
    expect(svgIconsAfter.length).toBe(0);
  });
});
