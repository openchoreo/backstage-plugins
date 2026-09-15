import { render, screen } from '@testing-library/react';
import { AuditLenses } from './AuditLenses';
import { AuditFilterValuesNotSupportedError } from '../../api/AuditLogsErrors';

const mockUseAuditFilterValues = jest.fn();

jest.mock('../../hooks/useAuditFilterValues', () => ({
  useAuditFilterValues: (...args: any[]) => mockUseAuditFilterValues(...args),
}));

jest.mock('@openchoreo/backstage-design-system', () => ({
  Skeleton: () => <span data-testid="skeleton" />,
}));

const aggregation = (over: Record<string, unknown> = {}) => ({
  values: [],
  totalValues: 0,
  loading: false,
  error: null,
  unsupported: false,
  ...over,
});

const defaults = {
  window: {
    startTime: '2026-09-01T00:00:00.000Z',
    endTime: '2026-09-08T00:00:00.000Z',
    clamped: false,
  },
  tokens: [],
  total: 42,
  onSelectResults: jest.fn(),
};

describe('AuditLenses', () => {
  beforeEach(() => jest.clearAllMocks());

  it('counts each outcome from the aggregation', () => {
    mockUseAuditFilterValues.mockReturnValue(
      aggregation({
        values: [
          { value: 'success', count: 30 },
          { value: 'denied', count: 12 },
        ],
        totalValues: 2,
      }),
    );

    render(<AuditLenses {...defaults} />);

    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    // The outcome the aggregation left out genuinely has none.
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('says a count is unknown rather than calling it zero', () => {
    mockUseAuditFilterValues.mockReturnValue(
      aggregation({
        error: new AuditFilterValuesNotSupportedError(),
        unsupported: true,
      }),
    );

    render(<AuditLenses {...defaults} />);

    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    // The exact total comes from the query itself, not the aggregation.
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('keeps the outcome filters usable when their counts are not', () => {
    mockUseAuditFilterValues.mockReturnValue(
      aggregation({ error: new Error('aggregation failed') }),
    );

    render(<AuditLenses {...defaults} />);

    expect(screen.getByRole('button', { name: /Denied/ })).toBeEnabled();
  });
});
