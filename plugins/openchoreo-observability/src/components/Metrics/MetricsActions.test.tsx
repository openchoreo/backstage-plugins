import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MetricsActions } from './MetricsActions';

// ---- Tests ----

describe('MetricsActions', () => {
  it('displays last updated text', () => {
    render(<MetricsActions disabled={false} onRefresh={jest.fn()} />);

    expect(screen.getByText(/Last updated at:/)).toBeInTheDocument();
  });

  it('shows Refresh button', () => {
    render(<MetricsActions disabled={false} onRefresh={jest.fn()} />);

    expect(
      screen.getByRole('button', { name: /refresh/i }),
    ).toBeInTheDocument();
  });

  it('calls onRefresh when clicked', async () => {
    const user = userEvent.setup();
    const onRefresh = jest.fn();
    render(<MetricsActions disabled={false} onRefresh={onRefresh} />);

    await user.click(screen.getByRole('button', { name: /refresh/i }));

    expect(onRefresh).toHaveBeenCalled();
  });

  it('disables Refresh button when disabled', () => {
    render(<MetricsActions disabled onRefresh={jest.fn()} />);

    expect(screen.getByRole('button', { name: /refresh/i })).toBeDisabled();
  });
});
