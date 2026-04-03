import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TracesActions } from './TracesActions';

// ---- Tests ----

describe('TracesActions', () => {
  it('displays total traces count', () => {
    render(
      <TracesActions totalCount={42} disabled={false} onRefresh={jest.fn()} />,
    );

    expect(screen.getByText('Total traces: 42')).toBeInTheDocument();
  });

  it('displays last updated text', () => {
    render(
      <TracesActions totalCount={0} disabled={false} onRefresh={jest.fn()} />,
    );

    expect(screen.getByText(/Last updated at:/)).toBeInTheDocument();
  });

  it('shows Refresh button', () => {
    render(
      <TracesActions totalCount={0} disabled={false} onRefresh={jest.fn()} />,
    );

    expect(
      screen.getByRole('button', { name: /refresh/i }),
    ).toBeInTheDocument();
  });

  it('calls onRefresh when clicked', async () => {
    const user = userEvent.setup();
    const onRefresh = jest.fn();
    render(
      <TracesActions totalCount={0} disabled={false} onRefresh={onRefresh} />,
    );

    await user.click(screen.getByRole('button', { name: /refresh/i }));

    expect(onRefresh).toHaveBeenCalled();
  });

  it('disables Refresh button when disabled', () => {
    render(
      <TracesActions totalCount={0} disabled={true} onRefresh={jest.fn()} />,
    );

    expect(
      screen.getByRole('button', { name: /refresh/i }),
    ).toBeDisabled();
  });
});
