import { render, screen } from '@testing-library/react';
import { RelativeTime } from './RelativeTime';

describe('RelativeTime', () => {
  it('shows a recent time relative to now', () => {
    render(
      <RelativeTime iso={new Date(Date.now() - 3 * 3600_000).toISOString()} />,
    );
    expect(screen.getByText('3 hours ago')).toBeInTheDocument();
  });

  it.each([undefined, '', 'not a date'])('shows a dash for %p', iso => {
    const { container } = render(<RelativeTime iso={iso} />);
    expect(container).toHaveTextContent(/^—$/);
  });
});
