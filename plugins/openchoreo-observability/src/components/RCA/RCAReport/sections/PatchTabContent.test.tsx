import { render, screen } from '@testing-library/react';
import { PatchTabContent } from './PatchTabContent';

jest.mock('../FormattedText', () => ({
  FormattedText: ({ text }: any) => <span>{text}</span>,
}));

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  ...jest.requireActual('@openchoreo/backstage-plugin-react'),
  useRcaUpdatePermission: () => ({
    canUpdateRca: true,
    loading: false,
    deniedTooltip: '',
  }),
}));

jest.mock('@backstage/core-plugin-api', () => ({
  ...jest.requireActual('@backstage/core-plugin-api'),
  useApi: () => ({ fetch: jest.fn() }),
}));

const chatContext = {
  namespaceName: 'ns',
  environmentName: 'env',
  projectName: 'proj',
  rcaAgentApi: { streamRCAChat: jest.fn(), updateActionStatuses: jest.fn() },
  backendBaseUrl: 'http://backend/api/observability',
} as any;

const action = (change: Record<string, unknown>) => ({
  index: 0,
  action: {
    description: 'Bump the connection pool',
    status: 'pending',
    change,
  } as any,
});

const renderTab = (change: Record<string, unknown>) =>
  render(
    <PatchTabContent
      reportId="rep-1"
      chatContext={chatContext}
      revisedActions={[action(change)]}
    />,
  );

describe('PatchTabContent target kind handling', () => {
  it('renders editable fields for a component binding', () => {
    renderTab({
      target_kind: 'ReleaseBinding',
      release_binding: 'svc-development',
      env: [{ key: 'POOL_SIZE', value: '20' }],
    });

    expect(screen.getByText('svc-development')).toBeInTheDocument();
    expect(screen.getByText('Workload Overrides')).toBeInTheDocument();
    expect(
      screen.queryByText(/portal version cannot apply/i),
    ).not.toBeInTheDocument();
  });

  it('renders a kind it cannot route as unsupported instead of crashing', () => {
    renderTab({
      target_kind: 'ProjectReleaseBinding',
      release_binding: 'proj-development',
      fields: [{ json_pointer: '/spec/whatever/x', value: '1' }],
    });

    expect(screen.getByText('proj-development')).toBeInTheDocument();
    expect(
      screen.getByText(/portal version cannot apply/i),
    ).toBeInTheDocument();
    expect(screen.queryByText('Workload Overrides')).not.toBeInTheDocument();
  });

  it('disables apply for a kind it cannot route', () => {
    renderTab({
      target_kind: 'ProjectReleaseBinding',
      release_binding: 'proj-development',
    });

    const applyButtons = screen
      .getAllByRole('button')
      .filter(b => /apply/i.test(b.textContent ?? ''));
    expect(applyButtons.length).toBeGreaterThan(0);
    for (const button of applyButtons) expect(button).toBeDisabled();
  });
});
