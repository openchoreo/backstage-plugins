import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RCAReportView } from './RCAReportView';
import type { AIRCAAgentComponents } from '@openchoreo/backstage-plugin-common';
import type { RCAAgentApi } from '../../../api/RCAAgentApi';

type RCAReportDetailed = AIRCAAgentComponents['schemas']['RCAReportDetailed'];

// Container test: stub the section children (one — PatchTabContent via
// QuickFixesPanelSection — needs a fetchApi) so we exercise RCAReportView's
// own wiring (panel state, Quick Fixes toggle, chat drawer mount) directly.
jest.mock('@backstage/core-components', () => ({
  InfoCard: ({ children }: any) => <div>{children}</div>,
}));
jest.mock('./sections/RCAChatDrawer', () => ({
  RCAChatDrawer: () => <div data-testid="rca-chat-drawer" />,
}));
jest.mock('./sections/QuickFixesPanelSection', () => ({
  QuickFixesPanelSection: () => <div data-testid="quick-fixes-panel" />,
}));
jest.mock('./sections/PatchTabContent', () => ({
  allActionsResolved: () => false,
}));
jest.mock('./sections/IncidentOverviewSection', () => ({
  IncidentOverviewSection: () => <div />,
}));
jest.mock('./sections/AssessmentSection', () => ({
  AssessmentSection: () => <div />,
}));
jest.mock('./sections/RootCausesSection', () => ({
  RootCausesSection: () => <div />,
}));
jest.mock('./sections/ExcludedCausesSection', () => ({
  ExcludedCausesSection: () => <div />,
}));
jest.mock('./sections/RecommendationsSection', () => ({
  RecommendationsSection: () => <div />,
}));
jest.mock('./sections/VisibilityImprovementsSection', () => ({
  VisibilityImprovementsSection: () => <div />,
}));
jest.mock('./sections/SystemTimelineSection', () => ({
  SystemTimelineSection: () => <div />,
}));
jest.mock('./sections/InvestigationPathSection', () => ({
  InvestigationPathSection: () => <div />,
}));

const chatContext = {
  namespaceName: 'ns',
  environmentName: 'env',
  projectName: 'proj',
  rcaAgentApi: {
    streamRCAChat: jest.fn(),
    updateActionStatuses: jest.fn(),
  } as unknown as RCAAgentApi,
};

const reportWithoutFixes = {
  reportId: 'rep-1',
  timestamp: '2026-01-01T10:00:00Z',
  report: {
    summary: 'A failure happened',
    result: {
      type: 'no_root_cause_identified',
      recommendations: { recommended_actions: [] },
    },
  },
} as unknown as RCAReportDetailed;

const reportWithFixes = {
  reportId: 'rep-2',
  timestamp: '2026-01-02T10:00:00Z',
  report: {
    summary: 'Root cause found',
    result: {
      type: 'root_cause_identified',
      timeline: [],
      root_causes: [],
      excluded_causes: [],
      recommendations: {
        recommended_actions: [{ status: 'revised', change: { kind: 'env' } }],
        observability_recommendations: [],
      },
    },
  },
} as unknown as RCAReportDetailed;

describe('RCAReportView', () => {
  it('always mounts the RCA chat drawer and hides Quick Fixes when there are none', () => {
    render(
      <RCAReportView
        report={reportWithoutFixes}
        reportId="rep-1"
        onBack={jest.fn()}
        chatContext={chatContext}
      />,
    );

    expect(screen.getByText('RCA Report')).toBeInTheDocument();
    expect(screen.getByTestId('rca-chat-drawer')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /quick fixes/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the Quick Fixes panel for revised actions and toggles it off', async () => {
    const user = userEvent.setup();
    render(
      <RCAReportView
        report={reportWithFixes}
        reportId="rep-2"
        onBack={jest.fn()}
        chatContext={chatContext}
      />,
    );

    // Panel auto-opens (unresolved revised actions) and the drawer is mounted.
    expect(screen.getByTestId('rca-chat-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('quick-fixes-panel')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /quick fixes/i }));

    expect(screen.queryByTestId('quick-fixes-panel')).not.toBeInTheDocument();
  });

  it('calls onBack when the back button is clicked', async () => {
    const user = userEvent.setup();
    const onBack = jest.fn();
    render(
      <RCAReportView
        report={reportWithoutFixes}
        reportId="rep-1"
        onBack={onBack}
        chatContext={chatContext}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: /back to rca reports/i }),
    );

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
