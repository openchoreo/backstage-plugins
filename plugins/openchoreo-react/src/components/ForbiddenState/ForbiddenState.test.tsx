import { render, screen, fireEvent } from '@testing-library/react';
import { ForbiddenState } from './ForbiddenState';

// Mock @backstage/core-components EmptyState used by the fullpage variant
jest.mock('@backstage/core-components', () => ({
  EmptyState: (props: any) => (
    <div data-testid="backstage-empty-state">
      <span>{props.title}</span>
      {props.description}
      {props.action}
    </div>
  ),
}));

describe('ForbiddenState', () => {
  it('renders title and message', () => {
    render(<ForbiddenState />);

    expect(screen.getByText('Insufficient Permissions')).toBeInTheDocument();
    expect(
      screen.getByText('You do not have permission to access this resource.'),
    ).toBeInTheDocument();
  });

  it('shows custom title and message when provided', () => {
    render(
      <ForbiddenState title="Access Denied" message="You need admin rights." />,
    );

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText('You need admin rights.')).toBeInTheDocument();
  });

  it('retry button calls onRetry', () => {
    const onRetry = jest.fn();
    render(<ForbiddenState onRetry={onRetry} />);

    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
