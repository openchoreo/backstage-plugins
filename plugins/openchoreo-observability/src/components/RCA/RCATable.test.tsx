import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import { RCATable } from './RCATable';

// ---- Mock dependencies (own sibling components only) ----

jest.mock('@openchoreo/backstage-design-system', () => ({
  StatusBadge: ({ label }: any) => (
    <span data-testid="status-badge">{label}</span>
  ),
}));

jest.mock('./RCAReport/FormattedText', () => ({
  FormattedText: ({ text }: any) => <span>{text}</span>,
}));

// ---- Helpers ----

const sampleReports = [
  {
    reportId: 'r1',
    alertId: 'alert-001',
    timestamp: '2024-06-01T10:00:00Z',
    summary: 'CPU spike caused by memory leak in api-service',
    status: 'completed' as const,
  },
  {
    reportId: 'r2',
    alertId: 'alert-002',
    timestamp: '2024-06-01T11:00:00Z',
    summary: '',
    status: 'pending' as const,
  },
  {
    reportId: 'r3',
    alertId: 'alert-003',
    timestamp: '2024-06-01T12:00:00Z',
    summary: 'Database connection pool exhausted',
    status: 'failed' as const,
  },
];

function renderTable(
  overrides: Partial<React.ComponentProps<typeof RCATable>> = {},
) {
  const defaultProps = {
    reports: sampleReports,
    loading: false,
    ...overrides,
  };

  return renderInTestApp(<RCATable {...defaultProps} />);
}

// ---- Tests ----

describe('RCATable', () => {
  it('renders table with report data', async () => {
    await renderTable();

    expect(
      screen.getByText('CPU spike caused by memory leak in api-service'),
    ).toBeInTheDocument();
  });

  it('shows "Generating RCA report..." for pending reports', async () => {
    await renderTable();

    expect(
      screen.getByText('Generating RCA report...'),
    ).toBeInTheDocument();
  });

  it('shows status badges', async () => {
    await renderTable();

    const badges = screen.getAllByTestId('status-badge');
    expect(badges.length).toBe(3);
    expect(badges[0]).toHaveTextContent('Available');
    expect(badges[1]).toHaveTextContent('Pending');
    expect(badges[2]).toHaveTextContent('Failed');
  });

  it('shows view report button for completed reports', async () => {
    await renderTable();

    expect(screen.getByLabelText('view report')).toBeInTheDocument();
  });

  it('shows disabled rerun button for failed reports', async () => {
    await renderTable();

    const rerunBtn = screen.getByLabelText('rerun report');
    expect(rerunBtn).toBeDisabled();
  });

  it('shows empty state when no reports', async () => {
    await renderTable({ reports: [] });

    expect(screen.getByText('No RCA reports found')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Try adjusting your filters or time range to see more reports.',
      ),
    ).toBeInTheDocument();
  });
});
