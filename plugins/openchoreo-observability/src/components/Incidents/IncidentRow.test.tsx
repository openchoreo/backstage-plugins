import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Table, TableBody } from '@material-ui/core';
import { IncidentRow } from './IncidentRow';
import { IncidentSummary } from '../../types';

// ---- Helpers ----

const sampleIncident: IncidentSummary = {
  incidentId: 'inc-12345678abcdef',
  alertId: 'alert-001',
  status: 'active',
  description: 'High CPU usage on api-service',
  triggeredAt: '2024-06-01T10:00:00.000Z',
  componentName: 'api-service',
  projectName: 'my-project',
  environmentName: 'production',
  namespaceName: 'prod-ns',
  incidentTriggerAiRca: true,
  notes: 'Escalated to on-call',
};

function renderRow(
  overrides: Partial<React.ComponentProps<typeof IncidentRow>> = {},
) {
  const defaultProps = {
    incident: sampleIncident,
    namespaceName: 'prod-ns',
    projectName: 'my-project',
    environmentName: 'production',
    onViewRCA: jest.fn(),
    onAcknowledge: jest.fn(),
    onResolve: jest.fn(),
  };

  return {
    ...render(
      <Table>
        <TableBody>
          <IncidentRow {...defaultProps} {...overrides} />
        </TableBody>
      </Table>,
    ),
    props: { ...defaultProps, ...overrides },
  };
}

// ---- Tests ----

describe('IncidentRow', () => {
  it('renders incident timestamp', () => {
    renderRow();

    expect(
      screen.getByText(new Date('2024-06-01T10:00:00.000Z').toLocaleString()),
    ).toBeInTheDocument();
  });

  it('renders truncated incident ID', () => {
    renderRow();

    expect(screen.getByText('inc-1234…')).toBeInTheDocument();
  });

  it('renders status chip in uppercase', () => {
    renderRow();

    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it('renders ACKNOWLEDGED status', () => {
    renderRow({
      incident: { ...sampleIncident, status: 'acknowledged' },
    });

    expect(screen.getByText('ACKNOWLEDGED')).toBeInTheDocument();
  });

  it('renders RESOLVED status', () => {
    renderRow({
      incident: { ...sampleIncident, status: 'resolved' },
    });

    expect(screen.getByText('RESOLVED')).toBeInTheDocument();
  });

  it('renders description', () => {
    renderRow();

    expect(
      screen.getByText('High CPU usage on api-service'),
    ).toBeInTheDocument();
  });

  it('renders component name', () => {
    renderRow();

    expect(screen.getByText('api-service')).toBeInTheDocument();
  });

  it('shows View RCA button when incidentTriggerAiRca is true', () => {
    renderRow();

    expect(screen.getAllByText('View RCA').length).toBeGreaterThanOrEqual(1);
  });

  it('does not show View RCA when incidentTriggerAiRca is false', () => {
    renderRow({
      incident: { ...sampleIncident, incidentTriggerAiRca: false },
    });

    expect(screen.queryByText('View RCA')).not.toBeInTheDocument();
  });

  it('expands to show incident details on row click', async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByText('High CPU usage on api-service'));

    expect(screen.getByText('Incident details')).toBeInTheDocument();
    expect(screen.getByText('Incident ID:')).toBeInTheDocument();
    expect(screen.getByText('Alert ID:')).toBeInTheDocument();
    expect(screen.getByText('Project:')).toBeInTheDocument();
    expect(screen.getByText('Component:')).toBeInTheDocument();
    expect(screen.getByText('Environment:')).toBeInTheDocument();
    expect(screen.getByText('Namespace:')).toBeInTheDocument();
  });

  it('shows notes when expanded', async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByText('High CPU usage on api-service'));

    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('Escalated to on-call')).toBeInTheDocument();
  });

  it('shows Acknowledge button for active incidents when expanded', async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByText('High CPU usage on api-service'));

    expect(screen.getByText('Acknowledge')).toBeInTheDocument();
  });

  it('shows Resolve button for acknowledged incidents when expanded', async () => {
    const user = userEvent.setup();
    renderRow({
      incident: { ...sampleIncident, status: 'acknowledged' },
    });

    await user.click(screen.getByText('High CPU usage on api-service'));

    expect(screen.getByText('Resolve')).toBeInTheDocument();
  });

  it('falls back to dash for missing fields', () => {
    renderRow({
      incident: {
        incidentId: 'i1',
        alertId: 'a1',
        status: 'active',
        triggeredAt: undefined,
        description: undefined,
        componentName: undefined,
      },
    });

    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });
});
