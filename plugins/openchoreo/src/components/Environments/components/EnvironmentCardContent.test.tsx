import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnvironmentCardContent } from './EnvironmentCardContent';
import type { EnvironmentCardContentProps } from '../types';

// ---- Mocks ----

jest.mock('@openchoreo/backstage-design-system', () => ({
  StatusBadge: ({ status }: { status: string }) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  formatRelativeTime: (ts: string) => `relative(${ts})`,
}));

jest.mock('./InvokeUrlsDialog', () => ({
  InvokeUrlsDialog: ({ open, endpoints }: any) =>
    open ? (
      <div data-testid="invoke-urls-dialog">{endpoints.length} endpoint(s)</div>
    ) : null,
}));

jest.mock('./IncidentsBanner', () => ({
  IncidentsBanner: ({ count, environmentName }: any) => (
    <div data-testid="incidents-banner">
      {count} incidents in {environmentName}
    </div>
  ),
}));

// ---- Helpers ----

function renderContent(overrides: Partial<EnvironmentCardContentProps> = {}) {
  const defaultProps: EnvironmentCardContentProps = {
    status: 'Ready',
    endpoints: [],
    onOpenReleaseDetails: jest.fn(),
    ...overrides,
  };

  return {
    ...render(<EnvironmentCardContent {...defaultProps} />),
    props: defaultProps,
  };
}

// ---- Tests ----

describe('EnvironmentCardContent', () => {
  it('shows deployed time when lastDeployed is provided', () => {
    renderContent({ lastDeployed: '2024-01-01T00:00:00Z' });

    expect(screen.getByText('Deployed')).toBeInTheDocument();
    expect(
      screen.getByText('relative(2024-01-01T00:00:00Z)'),
    ).toBeInTheDocument();
  });

  it('does not show deployed section when lastDeployed is absent', () => {
    renderContent({ lastDeployed: undefined });

    expect(screen.queryByText('Deployed')).not.toBeInTheDocument();
  });

  it('shows "active" status badge for Ready status', () => {
    renderContent({ status: 'Ready' });

    expect(screen.getByTestId('status-badge')).toHaveTextContent('active');
  });

  it('shows "pending" status badge for NotReady status', () => {
    renderContent({ status: 'NotReady' });

    expect(screen.getByTestId('status-badge')).toHaveTextContent('pending');
  });

  it('shows "failed" status badge for Failed status', () => {
    renderContent({ status: 'Failed' });

    expect(screen.getByTestId('status-badge')).toHaveTextContent('failed');
  });

  it('shows "undeployed" status badge for ResourcesUndeployed reason', () => {
    renderContent({
      status: 'Ready',
      statusReason: 'ResourcesUndeployed',
    });

    expect(screen.getByTestId('status-badge')).toHaveTextContent('undeployed');
  });

  it('shows View K8s Artifacts button when releaseName exists', () => {
    renderContent({ releaseName: 'release-1' });

    expect(
      screen.getByRole('button', { name: /view k8s artifacts/i }),
    ).toBeInTheDocument();
  });

  it('calls onOpenReleaseDetails when View K8s Artifacts is clicked', async () => {
    const user = userEvent.setup();
    const onOpenReleaseDetails = jest.fn();

    renderContent({ releaseName: 'release-1', onOpenReleaseDetails });

    await user.click(
      screen.getByRole('button', { name: /view k8s artifacts/i }),
    );
    expect(onOpenReleaseDetails).toHaveBeenCalled();
  });

  it('does not show artifacts button when releaseName is absent', () => {
    renderContent({ releaseName: undefined });

    expect(
      screen.queryByRole('button', { name: /view k8s artifacts/i }),
    ).not.toBeInTheDocument();
  });

  it('shows Endpoint URLs with count badge when Ready with endpoints', () => {
    renderContent({
      status: 'Ready',
      endpoints: [
        { url: 'https://api.example.com' },
        { url: 'https://web.example.com' },
      ] as any,
    });

    expect(screen.getByText('Endpoint URLs')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('opens InvokeUrlsDialog when eye icon is clicked', async () => {
    const user = userEvent.setup();

    renderContent({
      status: 'Ready',
      endpoints: [{ url: 'https://api.example.com' }] as any,
    });

    await user.click(screen.getByLabelText('Show endpoint URLs'));

    expect(screen.getByTestId('invoke-urls-dialog')).toBeInTheDocument();
    expect(screen.getByText('1 endpoint(s)')).toBeInTheDocument();
  });

  it('does not show endpoint URLs section when not Ready', () => {
    renderContent({
      status: 'NotReady',
      endpoints: [{ url: 'https://api.example.com' }] as any,
    });

    expect(screen.queryByText('Endpoint URLs')).not.toBeInTheDocument();
  });

  it('shows IncidentsBanner when there are active incidents', () => {
    renderContent({
      status: 'Ready',
      activeIncidentCount: 3,
      environmentName: 'production',
    });

    expect(screen.getByTestId('incidents-banner')).toBeInTheDocument();
    expect(screen.getByText('3 incidents in production')).toBeInTheDocument();
  });

  it('does not show IncidentsBanner when activeIncidentCount is 0', () => {
    renderContent({
      status: 'Ready',
      activeIncidentCount: 0,
      environmentName: 'production',
    });

    expect(screen.queryByTestId('incidents-banner')).not.toBeInTheDocument();
  });

  it('shows image when provided', () => {
    renderContent({ image: 'registry.io/my-service:v1.0.0' });

    expect(screen.getByText('Image')).toBeInTheDocument();
    expect(
      screen.getByText('registry.io/my-service:v1.0.0'),
    ).toBeInTheDocument();
  });

  it('does not show image section when image is absent', () => {
    renderContent({ image: undefined });

    expect(screen.queryByText('Image')).not.toBeInTheDocument();
  });
});
