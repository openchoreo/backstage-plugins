import { render, screen } from '@testing-library/react';
import { IncidentsTable } from './IncidentsTable';
import { IncidentSummary } from '../../types';

// ---- Mock IncidentRow ----
jest.mock('./IncidentRow', () => ({
  IncidentRow: ({ incident }: any) => (
    <tr data-testid={`incident-row-${incident.incidentId}`}>
      <td>{incident.description}</td>
    </tr>
  ),
}));

// ---- Helpers ----

const sampleIncident: IncidentSummary = {
  incidentId: 'inc-001',
  alertId: 'alert-001',
  status: 'active',
  description: 'High CPU on api-service',
  triggeredAt: '2024-06-01T10:00:00Z',
  componentName: 'api-service',
};

function renderTable(
  overrides: Partial<React.ComponentProps<typeof IncidentsTable>> = {},
) {
  const defaultProps = {
    incidents: [sampleIncident],
    loading: false,
    namespaceName: 'dev-ns',
    projectName: 'my-project',
  };

  return render(<IncidentsTable {...defaultProps} {...overrides} />);
}

// ---- Tests ----

describe('IncidentsTable', () => {
  it('renders table headers', () => {
    renderTable();

    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('Incident ID')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Component')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('renders incident rows', () => {
    renderTable();

    expect(screen.getByTestId('incident-row-inc-001')).toBeInTheDocument();
  });

  it('shows empty state when no incidents', () => {
    renderTable({ incidents: [] });

    expect(screen.getByText('No incidents found')).toBeInTheDocument();
    expect(
      screen.getByText(
        'No incidents match the current filters in the selected time range.',
      ),
    ).toBeInTheDocument();
  });

  it('shows loading skeletons when loading', () => {
    renderTable({ loading: true, incidents: [] });

    // 5 skeleton rows × 6 cells each
    const skeletons = document.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBe(30);
  });

  it('does not show empty state when loading', () => {
    renderTable({ loading: true, incidents: [] });

    expect(screen.queryByText('No incidents found')).not.toBeInTheDocument();
  });
});
