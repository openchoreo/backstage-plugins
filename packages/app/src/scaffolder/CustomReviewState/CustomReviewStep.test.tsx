import { render, screen } from '@testing-library/react';
import type { ReviewStepProps } from '@backstage/plugin-scaffolder-react';
import { CustomReviewStep } from './CustomReviewStep';

// Stub StructuredMetadataTable so we can read exactly what each review
// section forwards as its `metadata` prop.
jest.mock('@backstage/core-components', () => ({
  StructuredMetadataTable: (props: { metadata: Record<string, unknown> }) => (
    <div data-testid="smt" data-metadata={JSON.stringify(props.metadata)} />
  ),
}));

jest.mock('./styles', () => ({
  useStyles: () => ({
    reviewContent: 'reviewContent',
    sectionTitle: 'sectionTitle',
    footer: 'footer',
    promotionPathRow: 'promotionPathRow',
    envBox: 'envBox',
    arrow: 'arrow',
  }),
}));

const makeProps = (formData: Record<string, unknown>): ReviewStepProps =>
  ({
    formData,
    steps: [],
    handleBack: jest.fn(),
    handleCreate: jest.fn(),
    disableButtons: false,
  } as unknown as ReviewStepProps);

const tables = () =>
  screen
    .getAllByTestId('smt')
    .map(el => JSON.parse(el.getAttribute('data-metadata') || '{}'));

describe('CustomReviewStep — Project (per-ProjectType) templates', () => {
  it('renders Project Metadata and Parameters sections from a project template', () => {
    render(
      <CustomReviewStep
        {...makeProps({
          namespace_name: 'domain:default/default',
          project_name: 'web-app-demo',
          displayName: 'Web App Demo',
          description: 'A demo project',
          deployment_pipeline: 'default',
          parameters: { appName: 'my-app', replicas: 3 },
        })}
      />,
    );

    expect(screen.getByText('Project Metadata')).toBeInTheDocument();
    expect(screen.getByText('Parameters')).toBeInTheDocument();

    const all = tables();
    expect(all).toHaveLength(2);

    // Metadata table: namespace ref is shortened to its name.
    const meta = JSON.stringify(all[0]);
    expect(meta).toContain('default');
    expect(meta).toContain('web-app-demo');
    expect(meta).toContain('Web App Demo');

    // Parameters table: schema-driven values are flattened in.
    expect(JSON.stringify(all[1])).toContain('my-app');
  });

  it('omits the Parameters section for a type with no parameters', () => {
    render(
      <CustomReviewStep
        {...makeProps({
          namespace_name: 'domain:default/default',
          project_name: 'minimal-demo',
          deployment_pipeline: 'default',
        })}
      />,
    );

    expect(screen.getByText('Project Metadata')).toBeInTheDocument();
    expect(screen.queryByText('Parameters')).not.toBeInTheDocument();
    expect(tables()).toHaveLength(1);
  });
});

describe('CustomReviewStep — Notification Channel templates', () => {
  it('shows only webhook fields when type is webhook', () => {
    render(
      <CustomReviewStep
        {...makeProps({
          channelConfig: {
            namespace_name: 'domain:default/default',
            channel_name: 'dev-webhook',
            environment: 'environment:default/development',
            isEnvDefault: false,
            type: 'webhook',
            webhookConfig: {
              url: 'https://hooks.example.com',
              headers: [],
              payloadTemplate: 'payload',
            },
          },
        })}
      />,
    );

    expect(
      screen.getByText('Notification Channel Details'),
    ).toBeInTheDocument();
    const meta = JSON.stringify(tables()[0]);
    expect(meta).toContain('https://hooks.example.com');
    expect(meta).not.toContain('Email Config');
  });

  it('shows only email fields when type is email', () => {
    render(
      <CustomReviewStep
        {...makeProps({
          channelConfig: {
            namespace_name: 'domain:default/default',
            channel_name: 'dev-email',
            environment: 'environment:default/development',
            isEnvDefault: false,
            type: 'email',
            emailConfig: {
              from: 'alerts@example.com',
              to: ['team@example.com'],
              smtpHost: 'smtp.example.com',
              smtpPort: 587,
              smtpUsernameSecretName: 'smtp-auth',
              smtpUsernameSecretKey: 'username',
              smtpPasswordSecretName: 'smtp-auth',
              smtpPasswordSecretKey: 'password',
              insecureSkipVerify: false,
              subjectTemplate: 'Alert',
              bodyTemplate: 'Body',
            },
          },
        })}
      />,
    );

    const meta = JSON.stringify(tables()[0]);
    expect(meta).toContain('alerts@example.com');
    expect(meta).not.toContain('Webhook Config');
  });
});
