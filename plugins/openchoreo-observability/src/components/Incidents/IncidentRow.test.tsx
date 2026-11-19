import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Table, TableBody } from '@material-ui/core';
import { MemoryRouter } from 'react-router-dom';
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
      <MemoryRouter>
        <Table>
          <TableBody>
            <IncidentRow {...defaultProps} {...overrides} />
          </TableBody>
        </Table>
      </MemoryRouter>,
    ),
    props: { ...defaultProps, ...overrides },
  };
}

// ---- Tests ----

describe('IncidentRow', () => {
  it('shows the release line next to the component when present', async () => {
    const user = userEvent.setup();
    renderRow({ incident: { ...sampleIncident, releaseLineName: 'next' } });

    expect(screen.getByText('next')).toBeInTheDocument();

    await user.click(screen.getByText('High CPU usage on api-service'));
    expect(screen.getByText('Release Line:')).toBeInTheDocument();
  });

  it('shows no release line for an incident without one', async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByText('High CPU usage on api-service'));
    expect(screen.queryByText('Release Line:')).not.toBeInTheDocument();
  });

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

  it('links the component name to the component page', () => {
    renderRow({ catalogNamespace: 'my-ns' });

    expect(screen.getByText('api-service').closest('a')).toHaveAttribute(
      'href',
      '/catalog/my-ns/component/api-service',
    );
  });

  it('does not expand the row when the component link is clicked', async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByText('api-service'));

    expect(screen.queryByText('Incident details')).not.toBeInTheDocument();
  });

  it('does not render a component link when the component is missing', () => {
    renderRow({ incident: { ...sampleIncident, componentName: undefined } });

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows Acknowledge in the actions column when RCA is disabled', async () => {
    const user = userEvent.setup();
    const onAcknowledge = jest.fn();
    renderRow({
      incident: { ...sampleIncident, incidentTriggerAiRca: false },
      onAcknowledge,
    });

    await user.click(screen.getByText('Acknowledge'));

    expect(onAcknowledge).toHaveBeenCalledWith(
      expect.objectContaining({ incidentId: sampleIncident.incidentId }),
    );
    expect(screen.queryByText('Incident details')).not.toBeInTheDocument();
  });

  it('shows Resolve in the actions column for acknowledged incidents', () => {
    renderRow({
      incident: {
        ...sampleIncident,
        status: 'acknowledged',
        incidentTriggerAiRca: false,
      },
    });

    expect(screen.getByText('Resolve')).toBeInTheDocument();
  });

  it('shows no status action for resolved incidents', () => {
    renderRow({ incident: { ...sampleIncident, status: 'resolved' } });

    expect(screen.queryByText('Acknowledge')).not.toBeInTheDocument();
    expect(screen.queryByText('Resolve')).not.toBeInTheDocument();
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

    expect(screen.getAllByText('Acknowledge')).toHaveLength(2);
  });

  it('shows Resolve button for acknowledged incidents when expanded', async () => {
    const user = userEvent.setup();
    renderRow({
      incident: { ...sampleIncident, status: 'acknowledged' },
    });

    await user.click(screen.getByText('High CPU usage on api-service'));

    expect(screen.getAllByText('Resolve')).toHaveLength(2);
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
