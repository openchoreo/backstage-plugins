import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CostAnalysisTable } from './CostAnalysisTable';
import { FinOpsReportSummary } from '../../types';

jest.mock('@backstage/core-components', () => ({
  Table: ({ data, columns, isLoading, emptyContent }: any) => {
    if (isLoading) return <div data-testid="loading">Loading...</div>;
    if (!data || data.length === 0)
      return <div data-testid="empty">{emptyContent}</div>;
    return (
      <table>
        <tbody>
          {data.map((row: any, i: number) =>
            columns.map((col: any) => (
              <td key={`${i}-${col.field}`}>
                {col.render ? col.render(row) : row[col.field]}
              </td>
            )),
          )}
        </tbody>
      </table>
    );
  },
}));

jest.mock('@openchoreo/backstage-design-system', () => ({
  // Use the real design-system exports (so the real Skeleton renders); only
  // stub StatusBadge to keep the label-assertions below simple.
  ...jest.requireActual('@openchoreo/backstage-design-system'),
  StatusBadge: ({ label }: any) => (
    <span data-testid="status-badge">{label}</span>
  ),
}));

jest.mock('../RCA/RCAReport/FormattedText', () => ({
  FormattedText: ({ text }: any) => <span>{text}</span>,
}));

const baseReport: FinOpsReportSummary = {
  reportId: 'r1',
  namespace: 'dev',
  project: 'proj',
  timestamp: '2026-01-01T10:00:00Z',
  status: 'completed',
  component: 'api-service',
  summary: 'Cost analysis complete',
};

function renderTable(reports: FinOpsReportSummary[], loading = false) {
  return render(
    <MemoryRouter>
      <CostAnalysisTable reports={reports} loading={loading} />
    </MemoryRouter>,
  );
}

describe('CostAnalysisTable', () => {
  it('shows loading state', () => {
    // Loading renders skeleton placeholder cells, not the isLoading overlay.
    renderTable([], true);
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('shows empty state when no reports', () => {
    renderTable([]);
    expect(screen.getByTestId('empty')).toBeInTheDocument();
    expect(
      screen.getByText('No cost analysis reports found'),
    ).toBeInTheDocument();
  });

  it('renders completed report with Available status badge', () => {
    renderTable([baseReport]);
    expect(screen.getByTestId('status-badge')).toHaveTextContent('Available');
  });

  it('renders pending report with Pending status badge and generating message', () => {
    renderTable([{ ...baseReport, status: 'pending' }]);
    expect(screen.getByTestId('status-badge')).toHaveTextContent('Pending');
    expect(
      screen.getByText('Generating cost analysis report...'),
    ).toBeInTheDocument();
  });

  it('renders failed report with Failed status badge', () => {
    renderTable([{ ...baseReport, status: 'failed' }]);
    expect(screen.getByTestId('status-badge')).toHaveTextContent('Failed');
  });

  it('renders component name or N/A when missing', () => {
    renderTable([{ ...baseReport, component: undefined }]);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('renders N/A timestamp when timestamp is missing', () => {
    renderTable([{ ...baseReport, timestamp: undefined as any }]);
    expect(screen.getAllByText('N/A').length).toBeGreaterThan(0);
  });

  it('shows no summary available when summary is missing', () => {
    renderTable([{ ...baseReport, status: 'completed', summary: undefined }]);
    expect(screen.getByText('No summary available')).toBeInTheDocument();
  });
});
