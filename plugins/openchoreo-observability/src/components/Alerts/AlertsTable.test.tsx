import { render, screen } from '@testing-library/react';
import { AlertsTable } from './AlertsTable';
import { AlertSummary } from '../../types';

// ---- Helpers ----

const alerts: AlertSummary[] = [
  {
    alertId: 'alert-1',
    timestamp: '2024-06-01T10:00:00Z',
    ruleName: 'High Memory',
    severity: 'warning',
    sourceType: 'metric',
    alertValue: '85%',
  },
  {
    alertId: 'alert-2',
    timestamp: '2024-06-01T10:05:00Z',
    ruleName: 'Error Rate Spike',
    severity: 'critical',
    sourceType: 'log',
    alertValue: '12/min',
  },
];

function renderTable(
  overrides: Partial<React.ComponentProps<typeof AlertsTable>> = {},
) {
  const defaultProps = {
    alerts,
    loading: false,
    environmentName: 'development',
    projectName: 'my-project',
    componentName: 'api-service',
    namespaceName: 'dev-ns',
  };

  return render(<AlertsTable {...defaultProps} {...overrides} />);
}

// ---- Tests ----

describe('AlertsTable', () => {
  it('renders table headers', () => {
    renderTable();

    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('Rule')).toBeInTheDocument();
    expect(screen.getByText('Severity')).toBeInTheDocument();
    expect(screen.getByText('Source')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
  });

  it('renders alert rows', () => {
    renderTable();

    expect(screen.getByText('High Memory')).toBeInTheDocument();
    expect(screen.getByText('Error Rate Spike')).toBeInTheDocument();
  });

  it('shows empty state when no alerts and not loading', () => {
    renderTable({ alerts: [] });

    expect(screen.getByText('No alerts found')).toBeInTheDocument();
    expect(
      screen.getByText(
        'No alerts match the current filters in the selected time range.',
      ),
    ).toBeInTheDocument();
  });

  it('does not show empty state when loading', () => {
    renderTable({ alerts: [], loading: true });

    expect(screen.queryByText('No alerts found')).not.toBeInTheDocument();
  });

  it('shows loading skeletons when loading with no alerts', () => {
    renderTable({ alerts: [], loading: true });

    const skeletons = document.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows spinner when loading with existing alerts', () => {
    renderTable({ loading: true });

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders severity chips', () => {
    renderTable();

    expect(screen.getByText('WARNING')).toBeInTheDocument();
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
  });
});
