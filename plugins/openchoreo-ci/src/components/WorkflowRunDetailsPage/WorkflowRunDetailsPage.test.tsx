import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkflowRunDetailsPage } from './WorkflowRunDetailsPage';
import type { ModelsBuild } from '@openchoreo/backstage-plugin-common';

// ---- Mocks ----

jest.mock('@openchoreo/backstage-design-system', () => ({
  VerticalTabNav: ({ tabs, onChange, children }: any) => (
    <div data-testid="vertical-tab-nav">
      {tabs.map((t: any) => (
        <button
          key={t.id}
          data-testid={`tab-${t.id}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
      <div data-testid="tab-content">{children}</div>
    </div>
  ),
}));

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  formatRelativeTime: (ts: string) => `relative(${ts})`,
  useUrlSyncedTab: ({ defaultTab }: any) => {
    const [tab, setTab] = require('react').useState(defaultTab);
    return [tab, setTab];
  },
  DetailPageLayout: ({ title, subtitle, onBack, children }: any) => (
    <div data-testid="detail-page-layout">
      <span data-testid="page-title">{title}</span>
      <div data-testid="page-subtitle">{subtitle}</div>
      <button data-testid="back-button" onClick={onBack}>
        Back
      </button>
      {children}
    </div>
  ),
}));

jest.mock('../BuildStatusChip', () => ({
  BuildStatusChip: ({ status }: { status: string }) => (
    <span data-testid="build-status-chip">{status}</span>
  ),
}));

jest.mock('../BuildLogs', () => ({
  LogsContent: ({ build }: any) => (
    <div data-testid="logs-content">{build.name}</div>
  ),
}));

jest.mock('../BuildEvents', () => ({
  EventsContent: ({ build }: any) => (
    <div data-testid="events-content">{build.name}</div>
  ),
}));

jest.mock('../RunMetadataContent', () => ({
  RunMetadataContent: ({ build }: any) => (
    <div data-testid="run-metadata-content">{build.name}</div>
  ),
}));

// ---- Helpers ----

const defaultRun: ModelsBuild = {
  name: 'build-42',
  uuid: 'uuid-42',
  componentName: 'api-service',
  projectName: 'my-project',
  namespaceName: 'dev-ns',
  status: 'Succeeded',
  createdAt: '2024-06-01T10:00:00Z',
};

function renderPage(
  overrides: Partial<React.ComponentProps<typeof WorkflowRunDetailsPage>> = {},
) {
  const defaultProps = {
    run: defaultRun,
    onBack: jest.fn(),
  };

  return {
    ...render(<WorkflowRunDetailsPage {...defaultProps} {...overrides} />),
    props: { ...defaultProps, ...overrides },
  };
}

// ---- Tests ----

describe('WorkflowRunDetailsPage', () => {
  it('displays run name as title', () => {
    renderPage();

    expect(screen.getByTestId('page-title')).toHaveTextContent('build-42');
  });

  it('displays build status chip', () => {
    renderPage();

    expect(screen.getByTestId('build-status-chip')).toHaveTextContent(
      'Succeeded',
    );
  });

  it('displays relative time', () => {
    renderPage();

    expect(
      screen.getByText('relative(2024-06-01T10:00:00Z)'),
    ).toBeInTheDocument();
  });

  it('renders Logs, Events, and Details tabs', () => {
    renderPage();

    expect(screen.getByTestId('tab-logs')).toBeInTheDocument();
    expect(screen.getByTestId('tab-events')).toBeInTheDocument();
    expect(screen.getByTestId('tab-details')).toBeInTheDocument();
  });

  it('shows Logs content by default', () => {
    renderPage();

    expect(screen.getByTestId('logs-content')).toBeInTheDocument();
  });

  it('switches to Events tab when clicked', async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(screen.getByTestId('tab-events'));

    expect(screen.getByTestId('events-content')).toBeInTheDocument();
    expect(screen.queryByTestId('logs-content')).not.toBeInTheDocument();
  });

  it('switches to Details tab when clicked', async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(screen.getByTestId('tab-details'));

    expect(screen.getByTestId('run-metadata-content')).toBeInTheDocument();
    expect(screen.queryByTestId('logs-content')).not.toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', async () => {
    const user = userEvent.setup();
    const onBack = jest.fn();

    renderPage({ onBack });

    await user.click(screen.getByTestId('back-button'));

    expect(onBack).toHaveBeenCalled();
  });

  it('shows "Workflow Run" as title when run has no name', () => {
    renderPage({ run: { ...defaultRun, name: undefined } as any });

    expect(screen.getByTestId('page-title')).toHaveTextContent('Workflow Run');
  });
});
