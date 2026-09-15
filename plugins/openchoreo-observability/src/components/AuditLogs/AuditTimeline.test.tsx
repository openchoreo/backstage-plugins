import { render, screen } from '@testing-library/react';
import { AuditTimelineTooltip, intervalToMs } from './AuditTimeline';

describe('intervalToMs', () => {
  it('reads the widths the observer answers with', () => {
    expect(intervalToMs('15m')).toBe(900_000);
    expect(intervalToMs('1h')).toBe(3_600_000);
    expect(intervalToMs('7d')).toBe(604_800_000);
  });

  it('refuses a width it does not recognise rather than inventing one', () => {
    expect(intervalToMs('1y')).toBe(0);
    expect(intervalToMs('')).toBe(0);
  });
});

describe('AuditTimelineTooltip', () => {
  const bucket = {
    startTime: '2026-09-03T10:00:00.000Z',
    label: '10:00',
    total: 9,
    unattributed: 0,
    success: 5,
    failure: 0,
    denied: 3,
    unauthenticated: 1,
  };

  it('shows every outcome, including the ones with no events', () => {
    render(<AuditTimelineTooltip bucket={bucket} />);

    // A zero is a fact about the bucket, not a reason to omit the row — an
    // outcome missing from the tooltip reads as unknown rather than as none.
    expect(screen.getByText('Successful').parentElement).toHaveTextContent('5');
    expect(screen.getByText('Failed').parentElement).toHaveTextContent('0');
    expect(screen.getByText('Denied').parentElement).toHaveTextContent('3');
    expect(screen.getByText('Unauthenticated').parentElement).toHaveTextContent(
      '1',
    );
    expect(screen.getByText('Total').parentElement).toHaveTextContent('9');
  });

  it('accounts for records the backend did not break down', () => {
    // The contract carries `total` separately from `counts` so a bucket whose
    // breakdown is missing still reports a height. Showing four zeros against a
    // visible bar would say "nothing happened" when 9 things did.
    render(
      <AuditTimelineTooltip
        bucket={{
          ...bucket,
          success: 0,
          failure: 0,
          denied: 0,
          unauthenticated: 0,
          unattributed: 9,
        }}
      />,
    );

    expect(screen.getByText('Not broken down').parentElement).toHaveTextContent(
      '9',
    );
    expect(screen.getByText('Total').parentElement).toHaveTextContent('9');
  });

  it('stays quiet about the breakdown when it is complete', () => {
    render(<AuditTimelineTooltip bucket={bucket} />);

    expect(screen.queryByText('Not broken down')).not.toBeInTheDocument();
  });

  it('renders nothing when no bucket is hovered', () => {
    const { container } = render(<AuditTimelineTooltip />);

    expect(container).toBeEmptyDOMElement();
  });
});
