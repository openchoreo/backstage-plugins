import { useState } from 'react';
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from '@testing-library/react';
import type { FieldValidation } from '@rjsf/utils';
import type { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import {
  NotificationChannelFormWithYamlExtension,
  notificationChannelFormWithYamlValidation,
  type NotificationChannelFormData,
} from './NotificationChannelFormWithYamlExtension';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetEntities = jest.fn();
// A stable object reference, matching real Backstage's useApi() — it must
// NOT be recreated per call, or effects keyed on it (e.g. the environment
// fetch) would re-fire on every render and loop forever.
const mockCatalogApi = { getEntities: mockGetEntities };
jest.mock('@backstage/core-plugin-api', () => ({
  useApi: () => mockCatalogApi,
}));
jest.mock('@backstage/plugin-catalog-react', () => ({
  catalogApiRef: { id: 'catalog' },
}));

let namespaceFieldProps: any;
jest.mock('../NamespaceEntityPicker', () => ({
  NamespaceSelectField: (props: any) => {
    namespaceFieldProps = props;
    return (
      <input
        data-testid="namespace-select"
        value={props.value}
        onChange={e => props.onChange(e.target.value)}
      />
    );
  },
}));

let yamlEditorProps: any;
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  YamlEditor: (props: any) => {
    yamlEditorProps = props;
    return <div data-testid="yaml-editor" />;
  },
}));

let headersFormProps: any;
jest.mock('@openchoreo/backstage-design-system', () => ({
  FormYamlToggle: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: 'form' | 'yaml') => void;
  }) => (
    <div>
      <span data-testid="mode-value">{value}</span>
      <button onClick={() => onChange('form')}>switch-to-form</button>
      <button onClick={() => onChange('yaml')}>switch-to-yaml</button>
    </div>
  ),
  RjsfForm: (props: any) => {
    headersFormProps = props;
    return <div data-testid="headers-form" />;
  },
}));

// ---------------------------------------------------------------------------
// Test harness — mimics RJSF holding formData in parent state so the
// extension's controlled-component behavior can be exercised end-to-end.
// ---------------------------------------------------------------------------

let latestFormData: NotificationChannelFormData | undefined;

function Harness({
  initialFormData,
}: {
  initialFormData?: NotificationChannelFormData;
}) {
  const [formData, setFormData] = useState(initialFormData);
  const props = {
    formData,
    onChange: (next: NotificationChannelFormData | undefined) => {
      latestFormData = next;
      setFormData(next);
    },
  } as unknown as FieldExtensionComponentProps<NotificationChannelFormData>;
  return <NotificationChannelFormWithYamlExtension {...props} />;
}

// This form's `TextField`s don't pass an explicit `id`, so MUI v4 never
// wires the `<label>`'s `htmlFor` to the input's `id` — `getByLabelText`
// can't associate them. Walk from the label text to its FormControl instead.
function getFieldByLabel(label: string): HTMLElement {
  const labelEl = Array.from(document.querySelectorAll('label')).find(el =>
    el.textContent?.includes(label),
  );
  if (!labelEl) {
    throw new Error(`Could not find a label containing: ${label}`);
  }
  const field = labelEl
    .closest('.MuiFormControl-root')
    ?.querySelector('input, textarea');
  if (!field) {
    throw new Error(`Could not find an input/textarea for label: ${label}`);
  }
  return field as HTMLElement;
}

// MUI v4's outlined `TextField select` renders its clickable trigger as a
// `div[role="button"]`, with the real `<input>` marked `aria-hidden`, so
// `getByLabelText` can't associate it. Locate the trigger by walking up to
// the enclosing FormControl and checking its text instead. This same div
// carries `aria-disabled`, which jest-dom's `toBeDisabled()` falls back to
// for non-form elements, so it also doubles as the disabled-state target.
function getSelectTrigger(label: string): HTMLElement {
  const trigger = screen
    .getAllByRole('button')
    .find(btn =>
      btn.closest('.MuiFormControl-root')?.textContent?.includes(label),
    );
  if (!trigger) {
    throw new Error(`Could not find a select trigger for label: ${label}`);
  }
  return trigger;
}

function openSelect(label: string) {
  fireEvent.mouseDown(getSelectTrigger(label));
}

async function selectOption(name: RegExp | string) {
  const option = await screen.findByRole('option', { name });
  fireEvent.click(option);
}

const namespaceOptions = [
  { name: 'default', entityRef: 'domain:default/default' },
  { name: 'team-a', entityRef: 'domain:default/team-a' },
];

beforeEach(() => {
  jest.clearAllMocks();
  latestFormData = undefined;
  namespaceFieldProps = undefined;
  yamlEditorProps = undefined;
  headersFormProps = undefined;
  mockGetEntities.mockResolvedValue({ items: [] });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotificationChannelFormWithYamlExtension — initialization', () => {
  it('commits default email-type form data on mount when formData is empty', async () => {
    render(<Harness />);

    await waitFor(() => expect(latestFormData).toBeDefined());
    expect(latestFormData!.type).toBe('email');
    expect(latestFormData!.emailConfig).toBeDefined();
    expect(latestFormData!.webhookConfig).toBeUndefined();
  });

  it('does not re-initialize when formData is already provided', async () => {
    render(
      <Harness
        initialFormData={{
          namespace_name: 'domain:default/team-a',
          channel_name: 'existing',
          environment: '',
          isEnvDefault: false,
          type: 'email',
          emailConfig: {
            from: '',
            to: [],
            smtpHost: '',
            smtpPort: 587,
            smtpUsernameSecretName: '',
            smtpUsernameSecretKey: 'username',
            smtpPasswordSecretName: '',
            smtpPasswordSecretKey: 'password',
            insecureSkipVerify: false,
            subjectTemplate: '',
            bodyTemplate: '',
          },
        }}
      />,
    );

    expect(getFieldByLabel('Channel Name')).toHaveValue('existing');
  });

  it('auto-selects the "default" namespace once namespaces load', async () => {
    render(<Harness />);
    await waitFor(() => expect(namespaceFieldProps).toBeDefined());

    act(() => {
      namespaceFieldProps.onNamespacesLoaded(namespaceOptions);
    });

    await waitFor(() =>
      expect(latestFormData!.namespace_name).toBe('domain:default/default'),
    );
  });

  it('falls back to the first namespace when there is no "default"', async () => {
    render(<Harness />);
    await waitFor(() => expect(namespaceFieldProps).toBeDefined());

    act(() => {
      namespaceFieldProps.onNamespacesLoaded([
        { name: 'team-a', entityRef: 'domain:default/team-a' },
        { name: 'team-b', entityRef: 'domain:default/team-b' },
      ]);
    });

    await waitFor(() =>
      expect(latestFormData!.namespace_name).toBe('domain:default/team-a'),
    );
  });

  it('does not override an already-set namespace on load', async () => {
    render(
      <Harness
        initialFormData={{
          namespace_name: 'domain:default/team-a',
          channel_name: '',
          environment: '',
          isEnvDefault: false,
          type: 'email',
        }}
      />,
    );
    await waitFor(() => expect(namespaceFieldProps).toBeDefined());

    act(() => {
      namespaceFieldProps.onNamespacesLoaded(namespaceOptions);
    });

    // latestFormData is only set via onChange; since nothing should have
    // fired, it must remain unset.
    expect(latestFormData).toBeUndefined();
  });
});

describe('NotificationChannelFormWithYamlExtension — namespace & channel name', () => {
  it('updates namespace_name when the namespace field changes', async () => {
    render(<Harness />);
    await waitFor(() => expect(latestFormData).toBeDefined());

    fireEvent.change(screen.getByTestId('namespace-select'), {
      target: { value: 'domain:default/team-a' },
    });

    await waitFor(() =>
      expect(latestFormData!.namespace_name).toBe('domain:default/team-a'),
    );
    expect(mockGetEntities).toHaveBeenCalledWith({
      filter: { kind: 'Environment', 'metadata.namespace': 'team-a' },
    });
  });

  it('shows a format error for an invalid channel name', async () => {
    render(<Harness />);
    await waitFor(() => expect(latestFormData).toBeDefined());

    fireEvent.change(getFieldByLabel('Channel Name'), {
      target: { value: 'Invalid Name!' },
    });

    expect(
      screen.getByText(
        'Must be lowercase alphanumeric with hyphens, starting and ending with alphanumeric',
      ),
    ).toBeInTheDocument();
  });

  it('shows the default helper text for a valid channel name', async () => {
    render(<Harness />);
    await waitFor(() => expect(latestFormData).toBeDefined());

    fireEvent.change(getFieldByLabel('Channel Name'), {
      target: { value: 'my-channel' },
    });

    expect(
      screen.getByText('Unique name for your notification channel'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(latestFormData!.channel_name).toBe('my-channel'),
    );
  });
});

describe('NotificationChannelFormWithYamlExtension — target environment', () => {
  it('disables the environment select until a namespace is chosen', async () => {
    render(<Harness />);
    await waitFor(() => expect(latestFormData).toBeDefined());

    expect(getSelectTrigger('Target Environment')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByText('Select a namespace first')).toBeInTheDocument();
  });

  it('lists fetched environments and selects one', async () => {
    mockGetEntities.mockResolvedValue({
      items: [{ metadata: { name: 'dev', namespace: 'team-a' } }],
    });

    render(
      <Harness
        initialFormData={{
          namespace_name: 'domain:default/team-a',
          channel_name: '',
          environment: '',
          isEnvDefault: false,
          type: 'email',
        }}
      />,
    );

    await waitFor(() =>
      expect(getSelectTrigger('Target Environment')).not.toHaveAttribute(
        'aria-disabled',
      ),
    );

    openSelect('Target Environment');
    await selectOption('dev');

    await waitFor(() =>
      expect(latestFormData!.environment).toBe('environment:team-a/dev'),
    );
  });

  it('falls back to an empty environment list when the fetch fails', async () => {
    mockGetEntities.mockRejectedValue(new Error('boom'));

    render(
      <Harness
        initialFormData={{
          namespace_name: 'domain:default/team-a',
          channel_name: '',
          environment: '',
          isEnvDefault: false,
          type: 'email',
        }}
      />,
    );

    await waitFor(() =>
      expect(getSelectTrigger('Target Environment')).not.toHaveAttribute(
        'aria-disabled',
      ),
    );

    openSelect('Target Environment');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });
});

describe('NotificationChannelFormWithYamlExtension — isEnvDefault', () => {
  it('toggles the Environment Default switch', async () => {
    render(<Harness />);
    await waitFor(() => expect(latestFormData).toBeDefined());

    fireEvent.click(screen.getByText('Environment Default'));
    // The switch is adjacent; click its input directly instead.
    const switchInput = screen
      .getByText('Environment Default')
      .parentElement!.querySelector('input[type="checkbox"]')!;
    fireEvent.click(switchInput);

    await waitFor(() => expect(latestFormData!.isEnvDefault).toBe(true));
  });
});

describe('NotificationChannelFormWithYamlExtension — type switching', () => {
  it('switches from email to webhook, showing webhook fields and stripping emailConfig from the commit', async () => {
    render(<Harness />);
    await waitFor(() => expect(latestFormData).toBeDefined());

    expect(screen.getByText('Email Configuration')).toBeInTheDocument();

    openSelect('Channel Type');
    await selectOption('Webhook');

    await waitFor(() =>
      expect(screen.getByText('Webhook Configuration')).toBeInTheDocument(),
    );
    expect(screen.queryByText('Email Configuration')).not.toBeInTheDocument();
    expect(latestFormData!.type).toBe('webhook');
    expect(latestFormData!.webhookConfig).toBeDefined();
    expect(latestFormData!.emailConfig).toBeUndefined();
  });

  it('switches back to email, stripping webhookConfig from the commit', async () => {
    render(
      <Harness
        initialFormData={{
          namespace_name: '',
          channel_name: '',
          environment: '',
          isEnvDefault: false,
          type: 'webhook',
          webhookConfig: { url: '', headers: [], payloadTemplate: '' },
        }}
      />,
    );

    openSelect('Channel Type');
    await selectOption('Email');

    await waitFor(() => expect(latestFormData!.type).toBe('email'));
    expect(latestFormData!.emailConfig).toBeDefined();
    expect(latestFormData!.webhookConfig).toBeUndefined();
  });
});

describe('NotificationChannelFormWithYamlExtension — email fields', () => {
  it('updates from, to, smtp, secret, tls, and template fields', async () => {
    render(<Harness />);
    await waitFor(() => expect(latestFormData).toBeDefined());

    fireEvent.change(getFieldByLabel('From Address'), {
      target: { value: 'alerts@example.com' },
    });
    await waitFor(() =>
      expect(latestFormData!.emailConfig!.from).toBe('alerts@example.com'),
    );

    fireEvent.change(getFieldByLabel('To Addresses'), {
      target: { value: 'a@example.com, b@example.com' },
    });
    await waitFor(() =>
      expect(latestFormData!.emailConfig!.to).toEqual([
        'a@example.com',
        'b@example.com',
      ]),
    );

    fireEvent.change(getFieldByLabel('SMTP Host'), {
      target: { value: 'smtp.example.com' },
    });
    await waitFor(() =>
      expect(latestFormData!.emailConfig!.smtpHost).toBe('smtp.example.com'),
    );

    fireEvent.change(getFieldByLabel('SMTP Port'), {
      target: { value: '25' },
    });
    await waitFor(() => expect(latestFormData!.emailConfig!.smtpPort).toBe(25));

    fireEvent.change(getFieldByLabel('SMTP Username Secret Name'), {
      target: { value: 'smtp-auth' },
    });
    await waitFor(() =>
      expect(latestFormData!.emailConfig!.smtpUsernameSecretName).toBe(
        'smtp-auth',
      ),
    );

    fireEvent.change(getFieldByLabel('SMTP Username Secret Key'), {
      target: { value: 'user' },
    });
    await waitFor(() =>
      expect(latestFormData!.emailConfig!.smtpUsernameSecretKey).toBe('user'),
    );

    fireEvent.change(getFieldByLabel('SMTP Password Secret Name'), {
      target: { value: 'smtp-auth' },
    });
    await waitFor(() =>
      expect(latestFormData!.emailConfig!.smtpPasswordSecretName).toBe(
        'smtp-auth',
      ),
    );

    fireEvent.change(getFieldByLabel('SMTP Password Secret Key'), {
      target: { value: 'pass' },
    });
    await waitFor(() =>
      expect(latestFormData!.emailConfig!.smtpPasswordSecretKey).toBe('pass'),
    );

    const tlsSwitch = screen
      .getByText('Skip TLS Verification')
      .parentElement!.querySelector('input[type="checkbox"]')!;
    fireEvent.click(tlsSwitch);
    await waitFor(() =>
      expect(latestFormData!.emailConfig!.insecureSkipVerify).toBe(true),
    );

    fireEvent.change(getFieldByLabel('Subject Template'), {
      target: { value: 'Alert: ${alertName}' },
    });
    await waitFor(() =>
      expect(latestFormData!.emailConfig!.subjectTemplate).toBe(
        'Alert: ${alertName}',
      ),
    );

    fireEvent.change(getFieldByLabel('Body Template'), {
      target: { value: 'Details: ${alertDescription}' },
    });
    await waitFor(() =>
      expect(latestFormData!.emailConfig!.bodyTemplate).toBe(
        'Details: ${alertDescription}',
      ),
    );
  });
});

describe('NotificationChannelFormWithYamlExtension — webhook fields', () => {
  async function switchToWebhook() {
    render(<Harness />);
    await waitFor(() => expect(latestFormData).toBeDefined());
    openSelect('Channel Type');
    await selectOption('Webhook');
    await waitFor(() =>
      expect(screen.getByText('Webhook Configuration')).toBeInTheDocument(),
    );
  }

  it('updates the webhook URL and payload template', async () => {
    await switchToWebhook();

    fireEvent.change(getFieldByLabel('Webhook URL'), {
      target: { value: 'https://hooks.example.com' },
    });
    await waitFor(() =>
      expect(latestFormData!.webhookConfig!.url).toBe(
        'https://hooks.example.com',
      ),
    );

    fireEvent.change(getFieldByLabel('Payload Template'), {
      target: { value: '{"text": "${alertName}"}' },
    });
    await waitFor(() =>
      expect(latestFormData!.webhookConfig!.payloadTemplate).toBe(
        '{"text": "${alertName}"}',
      ),
    );
  });

  it('updates headers via the embedded RjsfForm', async () => {
    await switchToWebhook();
    expect(headersFormProps).toBeDefined();
    expect(headersFormProps.schema.properties.headers.title).toBe('Headers');

    act(() => {
      headersFormProps.onChange({
        formData: {
          headers: [
            {
              name: 'X-Api-Key',
              value: '',
              secretName: 'webhook-auth',
              secretKey: 'key',
            },
          ],
        },
      });
    });

    await waitFor(() =>
      expect(latestFormData!.webhookConfig!.headers).toEqual([
        {
          name: 'X-Api-Key',
          value: '',
          secretName: 'webhook-auth',
          secretKey: 'key',
        },
      ]),
    );
  });

  it('defaults to an empty headers array when the embedded form reports none', async () => {
    await switchToWebhook();

    act(() => {
      headersFormProps.onChange({ formData: {} });
    });

    await waitFor(() =>
      expect(latestFormData!.webhookConfig!.headers).toEqual([]),
    );
  });
});

describe('NotificationChannelFormWithYamlExtension — YAML mode', () => {
  it('populates the editor with the current form serialized as YAML on switch', async () => {
    render(
      <Harness
        initialFormData={{
          namespace_name: 'domain:default/team-a',
          channel_name: 'dev-email',
          environment: 'environment:team-a/dev',
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
        }}
      />,
    );

    fireEvent.click(screen.getByText('switch-to-yaml'));

    expect(yamlEditorProps.content).toContain(
      'kind: ObservabilityAlertsNotificationChannel',
    );
    expect(yamlEditorProps.content).toContain('name: dev-email');
    expect(yamlEditorProps.content).toContain('environment: dev');
  });

  it('populates the editor with webhook config, headers, and payload template', async () => {
    render(
      <Harness
        initialFormData={{
          namespace_name: 'domain:default/team-a',
          channel_name: 'dev-webhook',
          environment: 'environment:team-a/dev',
          isEnvDefault: true,
          type: 'webhook',
          webhookConfig: {
            url: 'https://hooks.example.com',
            headers: [
              {
                name: 'X-Api-Key',
                value: '',
                secretName: 'wh',
                secretKey: 'key',
              },
            ],
            payloadTemplate: '{"text": "${alertName}"}',
          },
        }}
      />,
    );

    fireEvent.click(screen.getByText('switch-to-yaml'));

    expect(yamlEditorProps.content).toContain('url: https://hooks.example.com');
    expect(yamlEditorProps.content).toContain('X-Api-Key');
    expect(yamlEditorProps.content).toContain('secretKeyRef');
    expect(yamlEditorProps.content).toContain('payloadTemplate');
  });

  it('resolves namespace and environment refs and parses headers when they match loaded options', async () => {
    mockGetEntities.mockResolvedValue({
      items: [{ metadata: { name: 'dev', namespace: 'team-a' } }],
    });

    render(<Harness />);
    await waitFor(() => expect(namespaceFieldProps).toBeDefined());

    act(() => {
      namespaceFieldProps.onNamespacesLoaded(namespaceOptions);
    });
    act(() => {
      namespaceFieldProps.onChange('domain:default/team-a');
    });
    await waitFor(() => expect(latestFormData!.environment).toBeDefined());

    fireEvent.click(screen.getByText('switch-to-yaml'));

    act(() => {
      yamlEditorProps.onChange(
        [
          'metadata:',
          '  name: from-yaml',
          '  namespace: team-a',
          'spec:',
          '  environment: dev',
          '  type: webhook',
          '  webhookConfig:',
          '    url: https://hooks.example.com',
          '    headers:',
          '      X-Api-Key:',
          '        valueFrom:',
          '          secretKeyRef:',
          '            name: wh',
          '            key: key',
        ].join('\n'),
      );
    });

    await waitFor(() =>
      expect(latestFormData!.namespace_name).toBe('domain:default/team-a'),
    );
    expect(latestFormData!.environment).toBe('environment:team-a/dev');
    expect(latestFormData!.webhookConfig!.headers).toEqual([
      { name: 'X-Api-Key', value: '', secretName: 'wh', secretKey: 'key' },
    ]);
  });

  it('commits parsed fields when editing valid YAML', async () => {
    render(<Harness />);
    await waitFor(() => expect(latestFormData).toBeDefined());

    fireEvent.click(screen.getByText('switch-to-yaml'));

    act(() => {
      yamlEditorProps.onChange(
        [
          'apiVersion: openchoreo.dev/v1alpha1',
          'kind: ObservabilityAlertsNotificationChannel',
          'metadata:',
          '  name: from-yaml',
          '  namespace: team-a',
          'spec:',
          '  environment: dev',
          '  isEnvDefault: false',
          '  type: webhook',
          '  webhookConfig:',
          '    url: https://hooks.example.com',
        ].join('\n'),
      );
    });

    await waitFor(() => expect(latestFormData!.channel_name).toBe('from-yaml'));
    expect(latestFormData!.type).toBe('webhook');
    expect(latestFormData!.webhookConfig!.url).toBe(
      'https://hooks.example.com',
    );
  });

  it('sets a parse error and does not commit when YAML is invalid', async () => {
    render(<Harness />);
    await waitFor(() => expect(latestFormData).toBeDefined());
    fireEvent.click(screen.getByText('switch-to-yaml'));

    const before = latestFormData;
    act(() => {
      yamlEditorProps.onChange('not: [valid: yaml');
    });

    expect(latestFormData).toBe(before);
    await waitFor(() =>
      expect(yamlEditorProps.errorText).toContain('YAML parse error'),
    );
  });

  it('switching back to form mode from valid YAML commits the parsed data', async () => {
    render(<Harness />);
    await waitFor(() => expect(latestFormData).toBeDefined());
    fireEvent.click(screen.getByText('switch-to-yaml'));

    act(() => {
      yamlEditorProps.onChange(
        [
          'metadata:',
          '  name: round-trip',
          '  namespace: team-a',
          'spec:',
          '  environment: dev',
          '  type: email',
          '  emailConfig:',
          '    from: a@b.com',
          '    to: [c@d.com]',
        ].join('\n'),
      );
    });

    fireEvent.click(screen.getByText('switch-to-form'));

    await waitFor(() =>
      expect(getFieldByLabel('Channel Name')).toHaveValue('round-trip'),
    );
  });

  it('stays on YAML mode and shows an error when switching back with invalid YAML', async () => {
    render(<Harness />);
    await waitFor(() => expect(latestFormData).toBeDefined());
    fireEvent.click(screen.getByText('switch-to-yaml'));

    act(() => {
      yamlEditorProps.onChange('not: [valid: yaml');
    });

    fireEvent.click(screen.getByText('switch-to-form'));

    expect(screen.getByTestId('mode-value')).toHaveTextContent('yaml');
    expect(yamlEditorProps.errorText).toContain('Failed to parse YAML');
  });
});

describe('notificationChannelFormWithYamlValidation', () => {
  function validate(value: Partial<NotificationChannelFormData>) {
    const errors: string[] = [];
    const validation: FieldValidation = {
      addError: (msg: string) => {
        errors.push(msg);
      },
    } as unknown as FieldValidation;
    notificationChannelFormWithYamlValidation(
      value as NotificationChannelFormData,
      validation,
    );
    return errors;
  }

  it('requires a channel name', () => {
    expect(validate({ namespace_name: 'a', environment: 'b' })).toContain(
      'Channel name is required',
    );
  });

  it('rejects an invalid channel name format', () => {
    expect(
      validate({
        channel_name: 'Bad Name!',
        namespace_name: 'a',
        environment: 'b',
      }),
    ).toContain(
      'Channel name must be lowercase alphanumeric with hyphens, starting and ending with alphanumeric',
    );
  });

  it('requires a namespace', () => {
    expect(validate({ channel_name: 'ok', environment: 'b' })).toContain(
      'Namespace is required',
    );
  });

  it('requires a target environment', () => {
    expect(validate({ channel_name: 'ok', namespace_name: 'a' })).toContain(
      'Target environment is required',
    );
  });

  it('requires email from/to/smtpHost when type is email', () => {
    const errors = validate({
      channel_name: 'ok',
      namespace_name: 'a',
      environment: 'b',
      type: 'email',
      emailConfig: {
        from: '',
        to: [],
        smtpHost: '',
      } as any,
    });
    expect(errors).toContain('Email "from" address is required');
    expect(errors).toContain('At least one "to" address is required');
    expect(errors).toContain('SMTP host is required');
  });

  it('rejects a malformed "from" address', () => {
    const errors = validate({
      channel_name: 'ok',
      namespace_name: 'a',
      environment: 'b',
      type: 'email',
      emailConfig: {
        from: 'not-an-email',
        to: ['c@d.com'],
        smtpHost: 'smtp.example.com',
      } as any,
    });
    expect(errors).toContain(
      'Email "from" address must be a valid email address',
    );
  });

  it('rejects a "to" list containing a malformed address', () => {
    const errors = validate({
      channel_name: 'ok',
      namespace_name: 'a',
      environment: 'b',
      type: 'email',
      emailConfig: {
        from: 'a@b.com',
        to: ['c@d.com', 'not-an-email'],
        smtpHost: 'smtp.example.com',
      } as any,
    });
    expect(errors).toContain(
      'All "to" addresses must be valid email addresses',
    );
  });

  it('accepts well-formed "from" and "to" addresses', () => {
    const errors = validate({
      channel_name: 'ok',
      namespace_name: 'a',
      environment: 'b',
      type: 'email',
      emailConfig: {
        from: 'alerts@example.com',
        to: ['team@example.com', 'oncall@example.com'],
        smtpHost: 'smtp.example.com',
      } as any,
    });
    expect(errors).not.toContain(
      'Email "from" address must be a valid email address',
    );
    expect(errors).not.toContain(
      'All "to" addresses must be valid email addresses',
    );
  });

  it('requires smtp secrets and templates when type is email', () => {
    const errors = validate({
      channel_name: 'ok',
      namespace_name: 'a',
      environment: 'b',
      type: 'email',
      emailConfig: {
        from: 'a@b.com',
        to: ['c@d.com'],
        smtpHost: 'smtp.example.com',
      } as any,
    });
    expect(errors).toContain('SMTP port must be between 1 and 65535');
    expect(errors).toContain('SMTP username secret name is required');
    expect(errors).toContain('SMTP username secret key is required');
    expect(errors).toContain('SMTP password secret name is required');
    expect(errors).toContain('SMTP password secret key is required');
    expect(errors).toContain('Subject template is required');
    expect(errors).toContain('Body template is required');
  });

  it('rejects an smtp port outside 1-65535', () => {
    const errors = validate({
      channel_name: 'ok',
      namespace_name: 'a',
      environment: 'b',
      type: 'email',
      emailConfig: {
        from: 'a@b.com',
        to: ['c@d.com'],
        smtpHost: 'smtp.example.com',
        smtpPort: 0,
      } as any,
    });
    expect(errors).toContain('SMTP port must be between 1 and 65535');
  });

  it('requires a webhook URL when type is webhook', () => {
    const errors = validate({
      channel_name: 'ok',
      namespace_name: 'a',
      environment: 'b',
      type: 'webhook',
      webhookConfig: { url: '' } as any,
    });
    expect(errors).toContain('Webhook URL is required');
  });

  it('rejects a webhook URL without a scheme', () => {
    const errors = validate({
      channel_name: 'ok',
      namespace_name: 'a',
      environment: 'b',
      type: 'webhook',
      webhookConfig: { url: 'asgsg' } as any,
    });
    expect(errors).toContain(
      'Webhook URL must be a valid absolute URI (e.g. https://example.com/webhook)',
    );
  });

  it('accepts a well-formed webhook URL', () => {
    const errors = validate({
      channel_name: 'ok',
      namespace_name: 'a',
      environment: 'b',
      type: 'webhook',
      webhookConfig: { url: 'https://hooks.example.com/services/x' } as any,
    });
    expect(errors).not.toContain(
      'Webhook URL must be a valid absolute URI (e.g. https://example.com/webhook)',
    );
  });

  it('rejects duplicate webhook header names', () => {
    const errors = validate({
      channel_name: 'ok',
      namespace_name: 'a',
      environment: 'b',
      type: 'webhook',
      webhookConfig: {
        url: 'https://hooks.example.com',
        headers: [
          { name: 'X-Api-Key', value: 'one', secretName: '', secretKey: '' },
          { name: 'X-Api-Key', value: 'two', secretName: '', secretKey: '' },
        ],
      } as any,
    });
    expect(errors).toContain('Webhook header names must be unique');
  });

  it('rejects a webhook header with only one of secretName/secretKey', () => {
    const errors = validate({
      channel_name: 'ok',
      namespace_name: 'a',
      environment: 'b',
      type: 'webhook',
      webhookConfig: {
        url: 'https://hooks.example.com',
        headers: [{ name: 'X-Api-Key', secretName: 'webhook-auth' }],
      } as any,
    });
    expect(errors).toContain(
      'Each webhook header must provide either "value" or both "secretName" and "secretKey"',
    );
  });

  it('rejects a webhook header with neither a value nor a secret pair', () => {
    const errors = validate({
      channel_name: 'ok',
      namespace_name: 'a',
      environment: 'b',
      type: 'webhook',
      webhookConfig: {
        url: 'https://hooks.example.com',
        headers: [{ name: 'X-Api-Key' }],
      } as any,
    });
    expect(errors).toContain(
      'Each webhook header must provide either "value" or both "secretName" and "secretKey"',
    );
  });

  it('accepts a webhook header backed by an inline value or a secret pair', () => {
    const errors = validate({
      channel_name: 'ok',
      namespace_name: 'a',
      environment: 'b',
      type: 'webhook',
      webhookConfig: {
        url: 'https://hooks.example.com',
        headers: [
          { name: 'Content-Type', value: 'application/json' },
          {
            name: 'X-Api-Key',
            secretName: 'webhook-auth',
            secretKey: 'key',
          },
        ],
      } as any,
    });
    expect(errors).not.toContain(
      'Each webhook header must provide either "value" or both "secretName" and "secretKey"',
    );
  });

  it('passes for a fully valid email channel', () => {
    expect(
      validate({
        channel_name: 'ok',
        namespace_name: 'a',
        environment: 'b',
        type: 'email',
        emailConfig: {
          from: 'a@b.com',
          to: ['c@d.com'],
          smtpHost: 'smtp.example.com',
          smtpPort: 587,
          smtpUsernameSecretName: 'smtp-auth',
          smtpUsernameSecretKey: 'username',
          smtpPasswordSecretName: 'smtp-auth',
          smtpPasswordSecretKey: 'password',
          subjectTemplate: 'Alert',
          bodyTemplate: 'Body',
        } as any,
      }),
    ).toHaveLength(0);
  });

  it('passes for a fully valid webhook channel', () => {
    expect(
      validate({
        channel_name: 'ok',
        namespace_name: 'a',
        environment: 'b',
        type: 'webhook',
        webhookConfig: { url: 'https://hooks.example.com' } as any,
      }),
    ).toHaveLength(0);
  });
});
