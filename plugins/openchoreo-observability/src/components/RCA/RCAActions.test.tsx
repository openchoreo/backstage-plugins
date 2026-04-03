import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RCAActions } from './RCAActions';

// ---- Tests ----

describe('RCAActions', () => {
  it('displays total reports count', () => {
    render(
      <RCAActions totalCount={10} disabled={false} onRefresh={jest.fn()} />,
    );

    expect(screen.getByText('Total reports: 10')).toBeInTheDocument();
  });

  it('shows "No reports data" when totalCount is undefined', () => {
    render(
      <RCAActions
        totalCount={undefined}
        disabled={false}
        onRefresh={jest.fn()}
      />,
    );

    expect(screen.getByText('No reports data')).toBeInTheDocument();
  });

  it('shows Refresh button', () => {
    render(
      <RCAActions totalCount={0} disabled={false} onRefresh={jest.fn()} />,
    );

    expect(
      screen.getByRole('button', { name: /refresh/i }),
    ).toBeInTheDocument();
  });

  it('calls onRefresh when clicked', async () => {
    const user = userEvent.setup();
    const onRefresh = jest.fn();
    render(
      <RCAActions totalCount={0} disabled={false} onRefresh={onRefresh} />,
    );

    await user.click(screen.getByRole('button', { name: /refresh/i }));

    expect(onRefresh).toHaveBeenCalled();
  });

  it('disables Refresh button when disabled', () => {
    render(
      <RCAActions totalCount={0} disabled onRefresh={jest.fn()} />,
    );

    expect(
      screen.getByRole('button', { name: /refresh/i }),
    ).toBeDisabled();
  });
});
