import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No items found" />);

    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('renders optional description', () => {
    render(
      <EmptyState
        title="No items found"
        description="Try adjusting your filters"
      />,
    );

    expect(screen.getByText('Try adjusting your filters')).toBeInTheDocument();
  });

  it('action button calls onClick when provided', () => {
    const onClick = jest.fn();
    render(
      <EmptyState
        title="No items found"
        action={{ label: 'Create Item', onClick }}
      />,
    );

    fireEvent.click(screen.getByText('Create Item'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not render action when not provided', () => {
    render(<EmptyState title="No items found" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
