import { render, screen } from '@testing-library/react';
import { IncidentOverviewSection } from './IncidentOverviewSection';

jest.mock('../FormattedText', () => ({
  FormattedText: ({ text }: any) => <span>{text}</span>,
}));

jest.mock('@backstage/core-components', () => ({
  InfoCard: ({ title, children }: any) => (
    <div>
      <div>{title}</div>
      {children}
    </div>
  ),
}));

const alertContext = (overrides: Record<string, unknown> = {}) =>
  ({
    alert_id: 'alert-1',
    alert_name: 'High error rate',
    triggered_at: '2026-10-20T10:00:00Z',
    trigger_value: 12,
    condition: { window: '5m', operator: 'gt', threshold: 10 },
    component: 'greeter',
    project: 'default',
    environment: 'development',
    ...overrides,
  } as any);

const renderSection = (context: any) =>
  render(
    <IncidentOverviewSection
      summary=""
      alertContext={context}
      reportId="report-1"
      formatTimestamp={t => t ?? ''}
    />,
  );

describe('IncidentOverviewSection', () => {
  it('shows the release line the alert fired on', () => {
    renderSection(alertContext({ release_line: 'canary' }));

    expect(screen.getByText('Release Line')).toBeInTheDocument();
    expect(screen.getByText('canary')).toBeInTheDocument();
  });

  it('omits the release line for components without one', () => {
    renderSection(alertContext({ release_line: null }));

    expect(screen.getByText('greeter')).toBeInTheDocument();
    expect(screen.queryByText('Release Line')).not.toBeInTheDocument();
  });
});
