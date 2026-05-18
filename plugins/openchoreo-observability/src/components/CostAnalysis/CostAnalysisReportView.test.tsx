import { render, screen, fireEvent } from '@testing-library/react';
import { CostAnalysisReportView } from './CostAnalysisReportView';
import { FinOpsReportDetailed } from '../../types';

jest.mock('@backstage/core-components', () => ({
  InfoCard: ({ title, children }: any) => (
    <div>
      <div>{typeof title === 'string' ? title : null}</div>
      <div>{children}</div>
    </div>
  ),
}));

jest.mock('../RCA/RCAReport/FormattedText', () => ({
  FormattedText: ({ text }: any) => <span>{text}</span>,
}));

const mockReport: FinOpsReportDetailed = {
  reportId: 'r1',
  namespace: 'dev',
  project: 'proj',
  timestamp: '2026-01-01T10:00:00Z',
  status: 'completed',
  report: {
    component: 'api-service',
    namespace: 'dev',
    project: 'proj',
    analysis_period: '2026-01-01 to 2026-01-07',
    budgeted_cost: {
      total_cost: 2.0,
      currency: 'USD',
      is_estimated: false,
    },
    actual_cost: {
      total_cost: 3.0,
      currency: 'USD',
      is_estimated: false,
    },
    resource_metrics: {
      data_available: true,
      cpu_request: '100m',
      cpu_limit: '200m',
      cpu_actual_avg: '80m',
      cpu_actual_peak: '150m',
      memory_request: '256Mi',
      memory_limit: '512Mi',
      memory_actual_avg: '200Mi',
      memory_actual_peak: '300Mi',
    },
    overprovisioning: {
      is_overprovisioned: true,
      cpu_utilization_pct: 40.5,
      memory_utilization_pct: 78.2,
      analysis: 'CPU is overprovisioned',
      recommendation: {
        cpu_request: '50m',
        cpu_limit: '100m',
        memory_request: '256Mi',
        memory_limit: '512Mi',
        rationale: 'Reduce CPU to save costs',
      },
    },
    summary: 'Overall cost is over budget',
    investigation_path: [
      {
        action: 'Check CPU',
        outcome: 'CPU is over-requested',
        rationale: 'Historical data shows low usage',
      },
    ],
  },
};

describe('CostAnalysisReportView', () => {
  it('renders report content unavailable when report.report is null', () => {
    const reportNoContent: FinOpsReportDetailed = {
      ...mockReport,
      report: null,
    };
    render(
      <CostAnalysisReportView
        report={reportNoContent}
        reportId="r1"
        onBack={jest.fn()}
      />,
    );
    expect(
      screen.getByText('Report content not available'),
    ).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', () => {
    const onBack = jest.fn();
    render(
      <CostAnalysisReportView
        report={mockReport}
        reportId="r1"
        onBack={onBack}
      />,
    );
    fireEvent.click(screen.getByTitle('Back to cost analysis reports'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows component, project, namespace and analysis period', () => {
    render(
      <CostAnalysisReportView
        report={mockReport}
        reportId="r1"
        onBack={jest.fn()}
      />,
    );
    expect(screen.getByText('api-service')).toBeInTheDocument();
    expect(screen.getByText('proj')).toBeInTheDocument();
    expect(screen.getByText('dev')).toBeInTheDocument();
    expect(screen.getByText('2026-01-01 to 2026-01-07')).toBeInTheDocument();
  });

  it('shows overprovisioned status', () => {
    render(
      <CostAnalysisReportView
        report={mockReport}
        reportId="r1"
        onBack={jest.fn()}
      />,
    );
    expect(screen.getByText('Overprovisioned')).toBeInTheDocument();
  });

  it('shows appropriately provisioned status when not overprovisioned', () => {
    const notOverprovisioned = {
      ...mockReport,
      report: {
        ...mockReport.report!,
        overprovisioning: {
          ...mockReport.report!.overprovisioning,
          is_overprovisioned: false,
        },
      },
    };
    render(
      <CostAnalysisReportView
        report={notOverprovisioned}
        reportId="r1"
        onBack={jest.fn()}
      />,
    );
    expect(screen.getByText('Appropriately Provisioned')).toBeInTheDocument();
  });

  it('shows over budget indicator', () => {
    render(
      <CostAnalysisReportView
        report={mockReport}
        reportId="r1"
        onBack={jest.fn()}
      />,
    );
    expect(screen.getAllByText(/over budget/).length).toBeGreaterThan(0);
  });

  it('shows under budget when actual < budget', () => {
    const underBudget = {
      ...mockReport,
      report: {
        ...mockReport.report!,
        actual_cost: {
          ...mockReport.report!.actual_cost,
          total_cost: 1.5,
        },
      },
    };
    render(
      <CostAnalysisReportView
        report={underBudget}
        reportId="r1"
        onBack={jest.fn()}
      />,
    );
    expect(screen.getByText(/under budget/)).toBeInTheDocument();
  });

  it('shows investigation path steps', () => {
    render(
      <CostAnalysisReportView
        report={mockReport}
        reportId="r1"
        onBack={jest.fn()}
      />,
    );
    expect(screen.getByText(/Step 1: Check CPU/)).toBeInTheDocument();
    expect(screen.getByText(/CPU is over-requested/)).toBeInTheDocument();
  });

  it('shows resource metrics when data_available is true', () => {
    render(
      <CostAnalysisReportView
        report={mockReport}
        reportId="r1"
        onBack={jest.fn()}
      />,
    );
    expect(screen.getAllByText('100m').length).toBeGreaterThan(0);
  });
});
