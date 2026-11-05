import { createNotificationChannelAction } from './notificationChannel';

const mockPOST = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    POST: mockPOST,
    GET: jest.fn(),
    PUT: jest.fn(),
    DELETE: jest.fn(),
  })),
}));

jest.mock('@openchoreo/backstage-plugin-catalog-backend-module', () => ({
  translateNotificationChannelToEntity: jest.fn(
    (data: any, ns: string, _opts: any) => ({
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'ObservabilityAlertsNotificationChannel',
      metadata: { name: data.name, namespace: ns },
      spec: { type: data.type, environment: data.environment },
    }),
  ),
}));

const buildConfig = (overrides: any = {}) => {
  const { baseUrl = 'http://test', authzEnabled = false } = overrides;
  return {
    getString: (k: string) => (k === 'openchoreo.baseUrl' ? baseUrl : ''),
    getOptionalBoolean: (k: string) =>
      k === 'openchoreo.features.auth.enabled' ? authzEnabled : undefined,
  } as any;
};

const buildCtx = (overrides: any = {}) => ({
  input: {
    namespaceName: 'domain:default/my-ns',
    channelName: 'dev-email',
    environment: 'environment:my-ns/dev',
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
      subjectTemplate: 'Alert: ${alertName}',
      bodyTemplate: 'Details: ${alertDescription}',
      contentType: 'text/html',
    },
    ...overrides.input,
  },
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
  output: jest.fn(),
  secrets: overrides.secrets,
});

const successResponse = (name = 'dev-email') => ({
  data: { metadata: { name }, spec: {} },
  error: undefined,
  response: { ok: true, status: 200 } as any,
});

describe('createNotificationChannelAction', () => {
  let mockCatalog: { insertEntity: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCatalog = { insertEntity: jest.fn().mockResolvedValue(undefined) };
  });

  it('creates an email notification channel and emits outputs', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createNotificationChannelAction(
      buildConfig(),
      mockCatalog as any,
    );
    const ctx = buildCtx();
    await action.handler(ctx as any);

    expect(mockPOST).toHaveBeenCalledWith(
      '/api/v1/namespaces/{namespaceName}/observabilityalertsnotificationchannels',
      expect.anything(),
    );
    const body = mockPOST.mock.calls[0][1].body;
    expect(body.spec.type).toBe('email');
    expect(body.spec.environment).toBe('dev');
    expect(body.spec.emailConfig.template.contentType).toBe('text/html');
    expect(body.spec.emailConfig.smtp.auth.username.secretKeyRef).toEqual({
      name: 'smtp-auth',
      key: 'username',
    });
    expect(ctx.output).toHaveBeenCalledWith('channelName', 'dev-email');
    expect(ctx.output).toHaveBeenCalledWith('namespaceName', 'my-ns');
  });

  it('passes the sender display name through when set', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createNotificationChannelAction(
      buildConfig(),
      mockCatalog as any,
    );
    const ctx = buildCtx();
    (ctx.input.emailConfig as any).fromName = '  Example Alerts  ';
    await action.handler(ctx as any);

    const body = mockPOST.mock.calls[0][1].body;
    expect(body.spec.emailConfig.from).toBe('alerts@example.com');
    expect(body.spec.emailConfig.fromName).toBe('Example Alerts');
  });

  it('omits the sender display name when it is empty', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createNotificationChannelAction(
      buildConfig(),
      mockCatalog as any,
    );
    const ctx = buildCtx();
    (ctx.input.emailConfig as any).fromName = '   ';
    await action.handler(ctx as any);

    const body = mockPOST.mock.calls[0][1].body;
    expect(body.spec.emailConfig).not.toHaveProperty('fromName');
  });

  it('rejects a sender display name longer than 128 characters', async () => {
    const action = createNotificationChannelAction(
      buildConfig(),
      mockCatalog as any,
    );
    const ctx = buildCtx();
    (ctx.input.emailConfig as any).fromName = 'a'.repeat(129);

    await expect(action.handler(ctx as any)).rejects.toThrow(
      /fromName must be at most 128 characters/,
    );
    expect(mockPOST).not.toHaveBeenCalled();
  });

  it.each([
    ['a line feed', 'Example\nAlerts'],
    ['a carriage return', 'Example\rAlerts'],
  ])(
    'rejects a sender display name containing %s',
    async (_label, fromName) => {
      const action = createNotificationChannelAction(
        buildConfig(),
        mockCatalog as any,
      );
      const ctx = buildCtx();
      (ctx.input.emailConfig as any).fromName = fromName;

      await expect(action.handler(ctx as any)).rejects.toThrow(
        /fromName must not contain line breaks/,
      );
      expect(mockPOST).not.toHaveBeenCalled();
    },
  );

  it('measures the sender display name after trimming', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createNotificationChannelAction(
      buildConfig(),
      mockCatalog as any,
    );
    const ctx = buildCtx();
    (ctx.input.emailConfig as any).fromName = ` ${'a'.repeat(128)} `;
    await action.handler(ctx as any);

    const body = mockPOST.mock.calls[0][1].body;
    expect(body.spec.emailConfig.fromName).toBe('a'.repeat(128));
  });

  it('defaults the email template content type to text/plain', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createNotificationChannelAction(
      buildConfig(),
      mockCatalog as any,
    );
    const ctx = buildCtx();
    delete (ctx.input.emailConfig as any).contentType;
    await action.handler(ctx as any);

    const body = mockPOST.mock.calls[0][1].body;
    expect(body.spec.emailConfig.template.contentType).toBe('text/plain');
  });

  it('builds webhook config with secret-backed headers', async () => {
    mockPOST.mockResolvedValueOnce(successResponse('dev-webhook'));
    const action = createNotificationChannelAction(
      buildConfig(),
      mockCatalog as any,
    );
    const ctx = buildCtx({
      input: {
        channelName: 'dev-webhook',
        type: 'webhook',
        emailConfig: undefined,
        webhookConfig: {
          url: 'https://hooks.example.com',
          headers: [
            { name: 'X-Api-Key', secretName: 'webhook-auth', secretKey: 'key' },
            { name: 'Content-Type', value: 'application/json' },
          ],
        },
      },
    });
    await action.handler(ctx as any);

    const body = mockPOST.mock.calls[0][1].body;
    expect(body.spec.type).toBe('webhook');
    expect(body.spec.webhookConfig.url).toBe('https://hooks.example.com');
    expect(body.spec.webhookConfig.headers['X-Api-Key']).toEqual({
      valueFrom: { secretKeyRef: { name: 'webhook-auth', key: 'key' } },
    });
    expect(body.spec.webhookConfig.headers['Content-Type']).toEqual({
      value: 'application/json',
    });
  });

  it('throws on API error', async () => {
    mockPOST.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'boom' },
      response: { ok: false, status: 500 } as any,
    });
    const action = createNotificationChannelAction(
      buildConfig(),
      mockCatalog as any,
    );
    await expect(action.handler(buildCtx() as any)).rejects.toThrow();
  });

  it('inserts into catalog', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createNotificationChannelAction(
      buildConfig(),
      mockCatalog as any,
    );
    await action.handler(buildCtx() as any);
    expect(mockCatalog.insertEntity).toHaveBeenCalledTimes(1);
    expect(mockCatalog.insertEntity.mock.calls[0][0].kind).toBe(
      'ObservabilityAlertsNotificationChannel',
    );
  });

  it('continues when catalog insert fails', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    mockCatalog.insertEntity.mockRejectedValueOnce(new Error('fail'));
    const action = createNotificationChannelAction(
      buildConfig(),
      mockCatalog as any,
    );
    const ctx = buildCtx();
    await action.handler(ctx as any);
    expect(ctx.output).toHaveBeenCalledWith('channelName', 'dev-email');
  });

  it('throws when authz enabled and no token', async () => {
    const action = createNotificationChannelAction(
      buildConfig({ authzEnabled: true }),
      mockCatalog as any,
    );
    await expect(action.handler(buildCtx() as any)).rejects.toThrow(
      /User authentication token not available/,
    );
  });

  it('throws when type is email but emailConfig is missing', async () => {
    const action = createNotificationChannelAction(
      buildConfig(),
      mockCatalog as any,
    );
    const ctx = buildCtx({ input: { emailConfig: undefined } });
    await expect(action.handler(ctx as any)).rejects.toThrow(
      /emailConfig is required/,
    );
    expect(mockPOST).not.toHaveBeenCalled();
  });

  it('throws when type is webhook but webhookConfig is missing', async () => {
    const action = createNotificationChannelAction(
      buildConfig(),
      mockCatalog as any,
    );
    const ctx = buildCtx({
      input: { type: 'webhook', emailConfig: undefined },
    });
    await expect(action.handler(ctx as any)).rejects.toThrow(
      /webhookConfig is required/,
    );
    expect(mockPOST).not.toHaveBeenCalled();
  });

  it('throws when a webhook header has only one of secretName/secretKey', async () => {
    const action = createNotificationChannelAction(
      buildConfig(),
      mockCatalog as any,
    );
    const ctx = buildCtx({
      input: {
        type: 'webhook',
        emailConfig: undefined,
        webhookConfig: {
          url: 'https://hooks.example.com',
          headers: [{ name: 'X-Api-Key', secretName: 'webhook-auth' }],
        },
      },
    });
    await expect(action.handler(ctx as any)).rejects.toThrow(
      /must provide either `value` or both `secretName` and `secretKey`/,
    );
    expect(mockPOST).not.toHaveBeenCalled();
  });

  it('throws when a webhook header provides neither a value nor a secret pair', async () => {
    const action = createNotificationChannelAction(
      buildConfig(),
      mockCatalog as any,
    );
    const ctx = buildCtx({
      input: {
        type: 'webhook',
        emailConfig: undefined,
        webhookConfig: {
          url: 'https://hooks.example.com',
          headers: [{ name: 'X-Api-Key' }],
        },
      },
    });
    await expect(action.handler(ctx as any)).rejects.toThrow(
      /must provide either `value` or both `secretName` and `secretKey`/,
    );
    expect(mockPOST).not.toHaveBeenCalled();
  });
});
