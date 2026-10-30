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
  buildSecretOptions,
  pickSecretKey,
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
let mockSecretReferences: any[] = [];
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  YamlEditor: (props: any) => {
    yamlEditorProps = props;
    return <div data-testid="yaml-editor" />;
  },
  useNamespaceSecretReferences: (namespaceName: string | undefined) => ({
    secretReferences: namespaceName ? mockSecretReferences : [],
    isLoading: false,
    isRefetching: false,
    error: null,
  }),
  filterSecretReferencesForObservabilityPlane: (refs: any[]) =>
    refs.filter(
      ref =>
        !ref.targetPlane ||
        ['ObservabilityPlane', 'ClusterObservabilityPlane'].includes(
          ref.targetPlane.kind,
        ),
    ),
}));

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
  // Plain selects in place of the MUI dropdowns, labeled like the real ones.
  SecretSelector: (props: any) => (
    <div>
      <select
        aria-label={props.nameLabel}
        value={props.secretName}
        disabled={props.disabled}
        onChange={e => props.onSecretNameChange(e.target.value)}
      >
        <option value="" />
        {props.secrets.map((secret: any) => (
          <option key={secret.name} value={secret.name}>
            {secret.displayName || secret.name}
          </option>
        ))}
      </select>
      <select
        aria-label={props.keyLabel}
        value={props.secretKey}
        disabled={props.disabled}
        onChange={e => props.onSecretKeyChange(e.target.value)}
      >
        <option value="" />
        {(
          props.secrets.find((secret: any) => secret.name === props.secretName)
            ?.keys ?? []
        ).map((key: string) => (
          <option key={key} value={key}>
            {key}
          </option>
        ))}
      </select>
    </div>
  ),
}));

function secretReference(
  name: string,
  keys: string[],
  targetPlane?: { kind: string; name: string },
) {
  return {
    name,
    namespace: 'team-a',
    data: keys.map(key => ({ secretKey: key, remoteRef: { key: name } })),
    targetPlane,
    createdAt: '2026-01-01T00:00:00Z',
    status: 'Ready',
  };
}

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
  mockSecretReferences = [];
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
    expect(latestFormData!.emailConfig!.contentType).toBe('text/plain');
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
            contentType: 'text/plain',
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

    mockSecretReferences = [
      secretReference('smtp-auth', ['username', 'password'], {
        kind: 'ClusterObservabilityPlane',
        name: 'default',
      }),
      secretReference('dp-only', ['token'], {
        kind: 'DataPlane',
        name: 'default',
      }),
    ];
    act(() => {
      namespaceFieldProps.onChange('domain:default/team-a');
    });
    await waitFor(() =>
      expect(
        screen.getByLabelText('SMTP Username Secret Reference'),
      ).not.toBeDisabled(),
    );
    expect(screen.queryAllByRole('option', { name: 'dp-only' })).toHaveLength(
      0,
    );

    fireEvent.change(screen.getByLabelText('SMTP Username Secret Reference'), {
      target: { value: 'smtp-auth' },
    });
    await waitFor(() =>
      expect(latestFormData!.emailConfig!.smtpUsernameSecretName).toBe(
        'smtp-auth',
      ),
    );
    expect(latestFormData!.emailConfig!.smtpUsernameSecretKey).toBe('username');

    fireEvent.change(screen.getByLabelText('SMTP Password Secret Reference'), {
      target: { value: 'smtp-auth' },
    });
    await waitFor(() =>
      expect(latestFormData!.emailConfig!.smtpPasswordSecretName).toBe(
        'smtp-auth',
      ),
    );
    expect(latestFormData!.emailConfig!.smtpPasswordSecretKey).toBe('password');

    fireEvent.change(screen.getByLabelText('SMTP Username Key'), {
      target: { value: 'password' },
    });
    await waitFor(() =>
      expect(latestFormData!.emailConfig!.smtpUsernameSecretKey).toBe(
        'password',
      ),
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

    openSelect('Content Type');
    await selectOption('text/html');
    await waitFor(() =>
      expect(latestFormData!.emailConfig!.contentType).toBe('text/html'),
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

  it('adds, edits, and removes headers', async () => {
    mockSecretReferences = [
      secretReference('webhook-auth', ['api-key'], {
        kind: 'ObservabilityPlane',
        name: 'default',
      }),
    ];
    await switchToWebhook();
    act(() => {
      namespaceFieldProps.onChange('domain:default/team-a');
    });

    fireEvent.click(screen.getByText('Add Header'));
    await waitFor(() =>
      expect(latestFormData!.webhookConfig!.headers).toEqual([
        { name: '', value: '', secretName: '', secretKey: '' },
      ]),
    );

    fireEvent.change(getFieldByLabel('Header Name'), {
      target: { value: 'X-Api-Key' },
    });
    await waitFor(() =>
      expect(latestFormData!.webhookConfig!.headers[0].name).toBe('X-Api-Key'),
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Secret Reference')).not.toBeDisabled(),
    );
    fireEvent.change(screen.getByLabelText('Secret Reference'), {
      target: { value: 'webhook-auth' },
    });
    // A reference with a single key gets that key picked.
    await waitFor(() =>
      expect(latestFormData!.webhookConfig!.headers).toEqual([
        {
          name: 'X-Api-Key',
          value: '',
          secretName: 'webhook-auth',
          secretKey: 'api-key',
        },
      ]),
    );
    expect(getFieldByLabel('Inline Value')).toBeDisabled();

    fireEvent.click(screen.getByLabelText('Remove header 1'));
    await waitFor(() =>
      expect(latestFormData!.webhookConfig!.headers).toEqual([]),
    );
  });

  it('disables the secret reference for a header with an inline value', async () => {
    await switchToWebhook();
    act(() => {
      namespaceFieldProps.onChange('domain:default/team-a');
    });
    fireEvent.click(screen.getByText('Add Header'));

    fireEvent.change(await waitFor(() => getFieldByLabel('Inline Value')), {
      target: { value: 'application/json' },
    });
    await waitFor(() =>
      expect(latestFormData!.webhookConfig!.headers[0].value).toBe(
        'application/json',
      ),
    );
    expect(screen.getByLabelText('Secret Reference')).toBeDisabled();
  });
});

describe('NotificationChannelFormWithYamlExtension — namespace change', () => {
  const withSecrets = (
    type: 'email' | 'webhook',
  ): NotificationChannelFormData => ({
    namespace_name: 'domain:default/team-a',
    channel_name: 'ch',
    environment: '',
    isEnvDefault: false,
    type,
    ...(type === 'email'
      ? {
          emailConfig: {
            from: 'a@example.com',
            to: ['b@example.com'],
            smtpHost: 'smtp.example.com',
            smtpPort: 587,
            smtpUsernameSecretName: 'smtp-auth',
            smtpUsernameSecretKey: 'username',
            smtpPasswordSecretName: 'smtp-auth',
            smtpPasswordSecretKey: 'password',
            insecureSkipVerify: false,
            subjectTemplate: 's',
            bodyTemplate: 'b',
            contentType: 'text/plain',
          },
        }
      : {
          webhookConfig: {
            url: 'https://hooks.example.com',
            headers: [
              {
                name: 'X-Api-Key',
                value: '',
                secretName: 'webhook-auth',
                secretKey: 'api-key',
              },
              {
                name: 'Content-Type',
                value: 'application/json',
                secretName: '',
                secretKey: '',
              },
            ],
            payloadTemplate: '',
          },
        }),
  });

  it('clears SMTP secret selections when the namespace changes', async () => {
    render(<Harness initialFormData={withSecrets('email')} />);
    await waitFor(() => expect(namespaceFieldProps).toBeDefined());

    act(() => {
      namespaceFieldProps.onChange('domain:default/team-b');
    });

    await waitFor(() =>
      expect(latestFormData!.namespace_name).toBe('domain:default/team-b'),
    );
    expect(latestFormData!.emailConfig).toMatchObject({
      smtpUsernameSecretName: '',
      smtpUsernameSecretKey: '',
      smtpPasswordSecretName: '',
      smtpPasswordSecretKey: '',
      smtpHost: 'smtp.example.com',
    });
  });

  it('clears header secret selections but keeps header names and inline values', async () => {
    render(<Harness initialFormData={withSecrets('webhook')} />);
    await waitFor(() => expect(namespaceFieldProps).toBeDefined());

    act(() => {
      namespaceFieldProps.onChange('domain:default/team-b');
    });

    await waitFor(() =>
      expect(latestFormData!.webhookConfig!.headers).toEqual([
        { name: 'X-Api-Key', value: '', secretName: '', secretKey: '' },
        {
          name: 'Content-Type',
          value: 'application/json',
          secretName: '',
          secretKey: '',
        },
      ]),
    );
  });

  it('keeps secret selections when the same namespace is selected again', async () => {
    render(<Harness initialFormData={withSecrets('email')} />);
    await waitFor(() => expect(namespaceFieldProps).toBeDefined());

    act(() => {
      namespaceFieldProps.onChange('domain:default/team-a');
    });

    expect(latestFormData).toBeUndefined();
  });
});

describe('buildSecretOptions', () => {
  it('lists references without a target plane or targeting an observability plane', () => {
    const options = buildSecretOptions(
      [
        secretReference('unscoped', ['a']) as any,
        secretReference('op', ['b'], {
          kind: 'ObservabilityPlane',
          name: 'default',
        }) as any,
        secretReference('dp', ['c'], {
          kind: 'DataPlane',
          name: 'default',
        }) as any,
      ],
      [],
    );
    expect(options.map(o => o.name)).toEqual(['unscoped', 'op']);
    expect(options[1].keys).toEqual(['b']);
  });

  it('keeps a selected name that is not among the references, with its key', () => {
    const options = buildSecretOptions(
      [secretReference('smtp-auth', ['username']) as any],
      [
        { name: 'legacy-k8s-secret', key: 'password' },
        { name: 'smtp-auth', key: 'other' },
        { name: '', key: '' },
      ],
    );
    expect(options).toEqual([
      {
        name: 'smtp-auth',
        displayName: undefined,
        keys: ['username', 'other'],
      },
      {
        name: 'legacy-k8s-secret',
        displayName:
          'legacy-k8s-secret (not a SecretReference for notification channels)',
        keys: ['password'],
      },
    ]);
  });
});

describe('pickSecretKey', () => {
  const options = [
    { name: 'smtp-auth', keys: ['username', 'password'] },
    { name: 'single', keys: ['token'] },
  ];

  it('picks the preferred key when the reference has it', () => {
    expect(pickSecretKey(options, 'smtp-auth', 'password')).toBe('password');
  });

  it('picks the only key of a single-key reference', () => {
    expect(pickSecretKey(options, 'single', 'password')).toBe('token');
  });

  it('picks nothing when the choice is ambiguous or the reference is unknown', () => {
    expect(pickSecretKey(options, 'smtp-auth', '')).toBe('');
    expect(pickSecretKey(options, 'missing', 'password')).toBe('');
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
            contentType: 'text/html',
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
    expect(yamlEditorProps.content).toContain('contentType: text/html');
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

  it('parses the email contentType from YAML and falls back to text/plain', async () => {
    render(<Harness />);
    await waitFor(() => expect(latestFormData).toBeDefined());
    fireEvent.click(screen.getByText('switch-to-yaml'));

    act(() => {
      yamlEditorProps.onChange(
        [
          'metadata:',
          '  name: html-email',
          '  namespace: team-a',
          'spec:',
          '  environment: dev',
          '  type: email',
          '  emailConfig:',
          '    from: alerts@example.com',
          '    to: [team@example.com]',
          '    template:',
          '      subject: Alert',
          '      body: "<b>Body</b>"',
          '      contentType: text/html',
        ].join('\n'),
      );
    });

    await waitFor(() =>
      expect(latestFormData!.emailConfig!.contentType).toBe('text/html'),
    );

    act(() => {
      yamlEditorProps.onChange(
        [
          'metadata:',
          '  name: html-email',
          '  namespace: team-a',
          'spec:',
          '  environment: dev',
          '  type: email',
          '  emailConfig:',
          '    from: alerts@example.com',
          '    to: [team@example.com]',
          '    template:',
          '      subject: Alert',
          '      body: Body',
          '      contentType: application/json',
        ].join('\n'),
      );
    });

    await waitFor(() =>
      expect(latestFormData!.emailConfig!.contentType).toBe('text/plain'),
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
    expect(errors).toContain('SMTP username secret reference is required');
    expect(errors).toContain('SMTP username secret reference key is required');
    expect(errors).toContain('SMTP password secret reference is required');
    expect(errors).toContain('SMTP password secret reference key is required');
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
      'Each webhook header must provide either an inline value or a secret reference and key',
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
      'Each webhook header must provide either an inline value or a secret reference and key',
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
      'Each webhook header must provide either an inline value or a secret reference and key',
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
          contentType: 'text/html',
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
