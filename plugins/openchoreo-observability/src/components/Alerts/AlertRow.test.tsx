import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Table, TableBody } from '@material-ui/core';
import { AlertRow } from './AlertRow';
import { AlertSummary } from '../../types';

// ---- Helpers ----

const sampleAlert: AlertSummary = {
  alertId: 'alert-123',
  timestamp: '2024-06-01T10:00:00.000Z',
  ruleName: 'High CPU Alert',
  ruleDescription: 'CPU usage exceeded 90% for 5 minutes',
  severity: 'critical',
  sourceType: 'metric',
  sourceMetric: 'cpu_usage_percent',
  alertValue: '95.2%',
  projectName: 'my-project',
  componentName: 'api-service',
  environmentName: 'production',
  namespaceName: 'prod-ns',
  notificationChannels: ['slack-alerts', 'pagerduty'],
  incidentEnabled: true,
};

function renderRow(
  overrides: Partial<React.ComponentProps<typeof AlertRow>> = {},
) {
  const defaultProps = {
    alert: sampleAlert,
    environmentName: 'production',
    projectName: 'my-project',
    componentName: 'api-service',
    namespaceName: 'prod-ns',
    onViewIncident: jest.fn(),
  };

  return {
    ...render(
      <Table>
        <TableBody>
          <AlertRow {...defaultProps} {...overrides} />
        </TableBody>
      </Table>,
    ),
    props: { ...defaultProps, ...overrides },
  };
}

// ---- Tests ----

describe('AlertRow', () => {
  it('renders alert timestamp', () => {
    renderRow();

    expect(
      screen.getByText(new Date('2024-06-01T10:00:00.000Z').toLocaleString()),
    ).toBeInTheDocument();
  });

  it('renders rule name', () => {
    renderRow();

    expect(screen.getByText('High CPU Alert')).toBeInTheDocument();
  });

  it('renders severity chip in uppercase', () => {
    renderRow();

    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
  });

  it('renders WARNING severity', () => {
    renderRow({ alert: { ...sampleAlert, severity: 'warning' } });

    expect(screen.getByText('WARNING')).toBeInTheDocument();
  });

  it('renders INFO severity', () => {
    renderRow({ alert: { ...sampleAlert, severity: 'info' } });

    expect(screen.getByText('INFO')).toBeInTheDocument();
  });

  it('renders source type', () => {
    renderRow();

    expect(screen.getByText('metric')).toBeInTheDocument();
  });

  it('renders alert value', () => {
    renderRow();

    expect(screen.getByText('95.2%')).toBeInTheDocument();
  });

  it('shows "View incident" button when incidentEnabled', () => {
    renderRow();

    expect(screen.getByText('View incident')).toBeInTheDocument();
  });

  it('does not show "View incident" when incidentEnabled is false', () => {
    renderRow({
      alert: { ...sampleAlert, incidentEnabled: false },
    });

    expect(screen.queryByText('View incident')).not.toBeInTheDocument();
  });

  it('expands to show alert details on row click', async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByText('High CPU Alert'));

    expect(screen.getByText('Alert details')).toBeInTheDocument();
    expect(screen.getByText('Alert ID:')).toBeInTheDocument();
    expect(screen.getByText('alert-123')).toBeInTheDocument();
    expect(screen.getByText('Project:')).toBeInTheDocument();
    expect(screen.getByText('Component:')).toBeInTheDocument();
    expect(screen.getByText('Environment:')).toBeInTheDocument();
    expect(screen.getByText('Namespace:')).toBeInTheDocument();
    expect(screen.getByText('Source Type:')).toBeInTheDocument();
  });

  it('shows metric field for metric source type when expanded', async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByText('High CPU Alert'));

    expect(screen.getByText('Metric:')).toBeInTheDocument();
    expect(screen.getByText('cpu_usage_percent')).toBeInTheDocument();
  });

  it('shows log query field for log source type when expanded', async () => {
    const user = userEvent.setup();
    renderRow({
      alert: {
        ...sampleAlert,
        sourceType: 'log',
        sourceQuery: 'level=ERROR',
        sourceMetric: undefined,
      },
    });

    await user.click(screen.getByText('High CPU Alert'));

    expect(screen.getByText('Log Query:')).toBeInTheDocument();
    expect(screen.getByText('level=ERROR')).toBeInTheDocument();
  });

  it('shows notification channels when expanded', async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByText('High CPU Alert'));

    expect(screen.getByText('Notification Channels:')).toBeInTheDocument();
    expect(screen.getByText('slack-alerts, pagerduty')).toBeInTheDocument();
  });

  it('shows rule description when expanded', async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByText('High CPU Alert'));

    expect(screen.getByText('Rule description')).toBeInTheDocument();
    expect(
      screen.getByText('CPU usage exceeded 90% for 5 minutes'),
    ).toBeInTheDocument();
  });

  it('collapses on second click', async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByText('High CPU Alert'));
    expect(screen.getByText('Alert details')).toBeInTheDocument();

    await user.click(screen.getByText('High CPU Alert'));
    expect(screen.queryByText('Alert details')).not.toBeInTheDocument();
  });

  it('calls onViewIncident when View incident is clicked in expanded view', async () => {
    const user = userEvent.setup();
    const onViewIncident = jest.fn();
    renderRow({ onViewIncident });

    // Expand the row first to get the outlined "View incident" button (not the hover one)
    await user.click(screen.getByText('High CPU Alert'));

    // Click the expanded view's "View incident" button (outlined variant)
    const viewIncidentButtons = screen.getAllByText('View incident');
    // The expanded one is a visible outlined button
    await user.click(viewIncidentButtons[viewIncidentButtons.length - 1]);

    expect(onViewIncident).toHaveBeenCalledWith(sampleAlert);
  });

  it('falls back to dash for missing fields', () => {
    renderRow({
      alert: {
        alertId: 'a1',
        timestamp: undefined,
        ruleName: undefined,
        severity: undefined,
        sourceType: undefined,
        alertValue: undefined,
      },
    });

    // Missing timestamp shows dash
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });
});
