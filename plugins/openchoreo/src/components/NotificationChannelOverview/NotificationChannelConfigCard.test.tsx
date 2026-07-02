import { render, screen } from '@testing-library/react';
import { NotificationChannelConfigCard } from './NotificationChannelConfigCard';

let mockEntity: any;
jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => ({ entity: mockEntity }),
}));

jest.mock('@backstage/core-components', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

jest.mock('@openchoreo/backstage-design-system', () => ({
  ...jest.requireActual('@openchoreo/backstage-design-system'),
  Card: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card">{children}</div>
  ),
}));

const baseEntity = (spec: Record<string, unknown>, namespace = 'my-ns') => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'ObservabilityAlertsNotificationChannel',
  metadata: { name: 'dev-channel', namespace },
  spec,
});

describe('NotificationChannelConfigCard', () => {
  it('renders email config details', () => {
    mockEntity = baseEntity({
      environment: 'dev',
      type: 'email',
      emailConfig: {
        from: 'alerts@example.com',
        to: ['team@example.com', 'oncall@example.com'],
        smtp: { host: 'smtp.example.com', port: 587 },
      },
    });

    render(<NotificationChannelConfigCard />);

    expect(screen.getByText('email')).toBeInTheDocument();
    expect(screen.getByText('alerts@example.com')).toBeInTheDocument();
    expect(
      screen.getByText('team@example.com, oncall@example.com'),
    ).toBeInTheDocument();
    expect(screen.getByText('smtp.example.com:587')).toBeInTheDocument();
  });

  it('renders webhook config details with inline and secret headers', () => {
    mockEntity = baseEntity({
      environment: 'dev',
      type: 'webhook',
      webhookConfig: {
        url: 'https://hooks.example.com',
        headers: {
          'Content-Type': { value: 'application/json' },
          'X-Api-Key': {
            valueFrom: { secretKeyRef: { name: 'webhook-auth' } },
          },
        },
      },
    });

    render(<NotificationChannelConfigCard />);

    expect(screen.getByText('webhook')).toBeInTheDocument();
    expect(screen.getByText('https://hooks.example.com')).toBeInTheDocument();
    expect(screen.getByText('Content-Type')).toBeInTheDocument();
    expect(screen.getByText('inline')).toBeInTheDocument();
    expect(screen.getByText('X-Api-Key')).toBeInTheDocument();
    expect(screen.getByText('secret: webhook-auth')).toBeInTheDocument();
  });

  it('omits the headers row when webhook has no headers', () => {
    mockEntity = baseEntity({
      environment: 'dev',
      type: 'webhook',
      webhookConfig: { url: 'https://hooks.example.com' },
    });

    render(<NotificationChannelConfigCard />);

    expect(screen.queryByText('Headers')).not.toBeInTheDocument();
  });

  it('shows the Environment Default badge only when isEnvDefault is true', () => {
    mockEntity = baseEntity({
      environment: 'dev',
      type: 'email',
      isEnvDefault: true,
      emailConfig: { from: 'a@b.com', to: ['c@d.com'], smtp: {} },
    });

    render(<NotificationChannelConfigCard />);
    expect(screen.getByText('Environment Default')).toBeInTheDocument();
  });

  it('does not show the Environment Default badge when isEnvDefault is false', () => {
    mockEntity = baseEntity({
      environment: 'dev',
      type: 'email',
      isEnvDefault: false,
      emailConfig: { from: 'a@b.com', to: ['c@d.com'], smtp: {} },
    });

    render(<NotificationChannelConfigCard />);
    expect(screen.queryByText('Environment Default')).not.toBeInTheDocument();
  });

  it('links the environment name to its catalog page under the entity namespace', () => {
    mockEntity = baseEntity(
      { environment: 'staging', type: 'email', emailConfig: {} },
      'team-ns',
    );

    render(<NotificationChannelConfigCard />);

    const link = screen.getByText('staging').closest('a');
    expect(link).toHaveAttribute(
      'href',
      '/catalog/team-ns/environment/staging',
    );
  });

  it('renders nothing when the entity has no spec', () => {
    mockEntity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'ObservabilityAlertsNotificationChannel',
      metadata: { name: 'dev-channel', namespace: 'my-ns' },
    };

    const { container } = render(<NotificationChannelConfigCard />);
    expect(container).toBeEmptyDOMElement();
  });
});
