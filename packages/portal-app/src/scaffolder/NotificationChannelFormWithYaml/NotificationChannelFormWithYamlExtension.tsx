import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import type { FieldValidation } from '@rjsf/utils';
import {
  Grid,
  TextField,
  MenuItem,
  Switch,
  Box,
  Typography,
} from '@material-ui/core';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { YamlEditor } from '@openchoreo/backstage-plugin-react';
import { FormYamlToggle, RjsfForm } from '@openchoreo/backstage-design-system';
import YAML from 'yaml';
import { useStyles } from './styles';
import {
  NamespaceSelectField,
  type NamespaceOption,
} from '../NamespaceEntityPicker';

export interface WebhookHeaderFormData {
  name: string;
  value: string;
  secretName: string;
  secretKey: string;
}

export interface NotificationChannelEmailConfigFormData {
  from: string;
  to: string[];
  smtpHost: string;
  smtpPort: number;
  smtpUsernameSecretName: string;
  smtpUsernameSecretKey: string;
  smtpPasswordSecretName: string;
  smtpPasswordSecretKey: string;
  insecureSkipVerify: boolean;
  subjectTemplate: string;
  bodyTemplate: string;
}

export interface NotificationChannelWebhookConfigFormData {
  url: string;
  headers: WebhookHeaderFormData[];
  payloadTemplate: string;
}

// Sub-schema for the webhook headers array, rendered via RjsfForm
const HEADERS_SCHEMA = {
  type: 'object',
  properties: {
    headers: {
      type: 'array',
      title: 'Headers',
      description: 'Optional HTTP headers to send with the webhook request',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', title: 'Header Name' },
          value: {
            type: 'string',
            title: 'Inline Value',
            description: 'Leave empty if sourcing from a secret',
          },
          secretName: {
            type: 'string',
            title: 'Secret Name',
            description:
              'Kubernetes Secret name (used instead of an inline value)',
          },
          secretKey: { type: 'string', title: 'Secret Key' },
        },
      },
    },
  },
} as const;

export interface NotificationChannelFormData {
  namespace_name: string;
  channel_name: string;
  environment: string;
  isEnvDefault: boolean;
  type: 'email' | 'webhook';
  /** Only present in the submitted value when `type` is "email". */
  emailConfig?: NotificationChannelEmailConfigFormData;
  /** Only present in the submitted value when `type` is "webhook". */
  webhookConfig?: NotificationChannelWebhookConfigFormData;
}

/**
 * Internal working shape used while editing — unlike the submitted
 * `NotificationChannelFormData`, both configs are always fully populated
 * (with defaults) so switching `type` back and forth doesn't lose in-progress
 * edits. `commit()` strips the inactive one before it reaches `onChange`.
 */
type NotificationChannelWorkingData = Omit<
  NotificationChannelFormData,
  'emailConfig' | 'webhookConfig'
> & {
  emailConfig: NotificationChannelEmailConfigFormData;
  webhookConfig: NotificationChannelWebhookConfigFormData;
};

const DEFAULT_FORM_DATA: NotificationChannelWorkingData = {
  namespace_name: '',
  channel_name: '',
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
  webhookConfig: {
    url: '',
    headers: [],
    payloadTemplate: '',
  },
};

/** Extract the last segment from an entity reference (e.g., "domain:default/name" -> "name") */
function extractName(entityRef: string): string {
  const parts = entityRef.split('/');
  return parts[parts.length - 1];
}

/** Kubernetes name validation: lowercase alphanumeric and hyphens, must start/end with alphanumeric */
function isValidK8sName(name: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name);
}

/** Matches the CRD's `spec.webhookConfig.url` OpenAPI `format: uri` constraint — must be an absolute URI with a scheme. */
function isValidAbsoluteUri(value: string): boolean {
  try {
    const parsed = new URL(value);
    return Boolean(parsed.protocol);
  } catch {
    return false;
  }
}

/** Basic email shape check — not RFC 5322-exhaustive, just enough to catch typos/garbage input. */
function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function formToYaml(data: NotificationChannelWorkingData): string {
  const spec: Record<string, unknown> = {
    environment: extractName(data.environment),
    isEnvDefault: data.isEnvDefault,
    type: data.type,
  };

  if (data.type === 'email') {
    spec.emailConfig = {
      from: data.emailConfig.from,
      to: data.emailConfig.to,
      smtp: {
        host: data.emailConfig.smtpHost,
        port: data.emailConfig.smtpPort,
        auth: {
          username: {
            secretKeyRef: {
              name: data.emailConfig.smtpUsernameSecretName,
              key: data.emailConfig.smtpUsernameSecretKey,
            },
          },
          password: {
            secretKeyRef: {
              name: data.emailConfig.smtpPasswordSecretName,
              key: data.emailConfig.smtpPasswordSecretKey,
            },
          },
        },
        tls: { insecureSkipVerify: data.emailConfig.insecureSkipVerify },
      },
      template: {
        subject: data.emailConfig.subjectTemplate,
        body: data.emailConfig.bodyTemplate,
      },
    };
  } else {
    spec.webhookConfig = {
      url: data.webhookConfig.url,
      ...(data.webhookConfig.headers.length > 0 && {
        headers: Object.fromEntries(
          data.webhookConfig.headers
            .filter(h => h.name)
            .map(h => [
              h.name,
              h.secretName && h.secretKey
                ? {
                    valueFrom: {
                      secretKeyRef: { name: h.secretName, key: h.secretKey },
                    },
                  }
                : { value: h.value },
            ]),
        ),
      }),
      ...(data.webhookConfig.payloadTemplate && {
        payloadTemplate: data.webhookConfig.payloadTemplate,
      }),
    };
  }

  const template = {
    apiVersion: 'openchoreo.dev/v1alpha1',
    kind: 'ObservabilityAlertsNotificationChannel',
    metadata: {
      name: data.channel_name,
      namespace: extractName(data.namespace_name),
    },
    spec,
  };

  return YAML.stringify(template, { indent: 2 });
}

function yamlToForm(
  yamlContent: string,
  namespaces: Array<{ name: string; entityRef: string }>,
  environments: Array<{ name: string; entityRef: string }>,
): Partial<NotificationChannelFormData> {
  const parsed = YAML.parse(yamlContent);
  if (!parsed || typeof parsed !== 'object') return {};

  const namespaceName = parsed.metadata?.namespace || '';
  const environmentName = parsed.spec?.environment || '';
  const matchedNamespace = namespaces.find(
    ns => extractName(ns.entityRef) === namespaceName,
  );
  const matchedEnvironment = environments.find(
    env => env.name === environmentName,
  );

  const type: 'email' | 'webhook' =
    parsed.spec?.type === 'webhook' ? 'webhook' : 'email';

  const emailSpec = parsed.spec?.emailConfig || {};
  const webhookSpec = parsed.spec?.webhookConfig || {};
  const headerEntries = Object.entries(webhookSpec.headers || {}) as [
    string,
    Record<string, any>,
  ][];

  return {
    namespace_name: matchedNamespace?.entityRef || '',
    channel_name: parsed.metadata?.name || '',
    environment: matchedEnvironment?.entityRef || '',
    isEnvDefault: parsed.spec?.isEnvDefault ?? false,
    type,
    emailConfig: {
      from: emailSpec.from || '',
      to: emailSpec.to || [],
      smtpHost: emailSpec.smtp?.host || '',
      smtpPort: emailSpec.smtp?.port || 587,
      smtpUsernameSecretName:
        emailSpec.smtp?.auth?.username?.secretKeyRef?.name || '',
      smtpUsernameSecretKey:
        emailSpec.smtp?.auth?.username?.secretKeyRef?.key || 'username',
      smtpPasswordSecretName:
        emailSpec.smtp?.auth?.password?.secretKeyRef?.name || '',
      smtpPasswordSecretKey:
        emailSpec.smtp?.auth?.password?.secretKeyRef?.key || 'password',
      insecureSkipVerify: emailSpec.smtp?.tls?.insecureSkipVerify ?? false,
      subjectTemplate: emailSpec.template?.subject || '',
      bodyTemplate: emailSpec.template?.body || '',
    },
    webhookConfig: {
      url: webhookSpec.url || '',
      headers: headerEntries.map(([name, header]) => ({
        name,
        value: header?.value || '',
        secretName: header?.valueFrom?.secretKeyRef?.name || '',
        secretKey: header?.valueFrom?.secretKeyRef?.key || '',
      })),
      payloadTemplate: webhookSpec.payloadTemplate || '',
    },
  };
}

export const NotificationChannelFormWithYamlExtension = ({
  onChange,
  formData,
}: FieldExtensionComponentProps<NotificationChannelFormData>) => {
  const classes = useStyles();
  const catalogApi = useApi(catalogApiRef);

  const [mode, setMode] = useState<'form' | 'yaml'>('form');
  const [yamlContent, setYamlContent] = useState('');
  const [yamlError, setYamlError] = useState<string | undefined>();

  const [namespaces, setNamespaces] = useState<NamespaceOption[]>([]);
  const [environments, setEnvironments] = useState<
    Array<{ name: string; entityRef: string }>
  >([]);
  const [loadingEnvironments, setLoadingEnvironments] = useState(false);

  const initializedRef = useRef(false);
  const nsPreselectedRef = useRef(false);
  const formDataRef = useRef(formData);

  const data: NotificationChannelWorkingData = useMemo(
    () => ({
      ...DEFAULT_FORM_DATA,
      ...formData,
      emailConfig: {
        ...DEFAULT_FORM_DATA.emailConfig,
        ...formData?.emailConfig,
      },
      webhookConfig: {
        ...DEFAULT_FORM_DATA.webhookConfig,
        ...formData?.webhookConfig,
      },
    }),
    [formData],
  );
  const dataRef = useRef(data);

  useEffect(() => {
    formDataRef.current = formData;
    dataRef.current = data;
  });

  // Only the config matching the currently selected `type` is submitted
  const commit = useCallback(
    (next: NotificationChannelFormData) => {
      const { emailConfig, webhookConfig, ...rest } = next;
      onChange({
        ...rest,
        ...(next.type === 'email' ? { emailConfig } : {}),
        ...(next.type === 'webhook' ? { webhookConfig } : {}),
      });
    },
    [onChange],
  );

  // Fetch Environment entities scoped to the selected namespace
  useEffect(() => {
    const nsName = data.namespace_name ? extractName(data.namespace_name) : '';
    if (!nsName) {
      setEnvironments([]);
      if (data.environment) {
        commit({ ...dataRef.current, environment: '' });
      }
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      return () => {};
    }

    let cancelled = false;
    setLoadingEnvironments(true);
    catalogApi
      .getEntities({
        filter: { kind: 'Environment', 'metadata.namespace': nsName },
      })
      .then(result => {
        if (cancelled) return;
        const nextEnvironments = result.items.map(entity => ({
          name: entity.metadata.name,
          entityRef: `environment:${entity.metadata.namespace || 'default'}/${
            entity.metadata.name
          }`,
        }));
        setEnvironments(nextEnvironments);
        if (
          data.environment &&
          !nextEnvironments.some(env => env.entityRef === data.environment)
        ) {
          commit({ ...dataRef.current, environment: '' });
        }
      })
      .catch(() => {
        if (!cancelled) setEnvironments([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingEnvironments(false);
      });

    return () => {
      cancelled = true;
    };
  }, [data.namespace_name, data.environment, catalogApi, commit]);

  // Initialize form data on mount if empty
  useEffect(() => {
    if (!initializedRef.current && !formData) {
      initializedRef.current = true;
      commit(DEFAULT_FORM_DATA);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateField = useCallback(
    (field: keyof NotificationChannelFormData, value: unknown) => {
      commit({ ...data, [field]: value });
    },
    [data, commit],
  );

  const updateEmailField = useCallback(
    (field: keyof NotificationChannelEmailConfigFormData, value: unknown) => {
      commit({
        ...data,
        emailConfig: { ...data.emailConfig, [field]: value },
      });
    },
    [data, commit],
  );

  const updateWebhookField = useCallback(
    (field: keyof NotificationChannelWebhookConfigFormData, value: unknown) => {
      commit({
        ...data,
        webhookConfig: { ...data.webhookConfig, [field]: value },
      });
    },
    [data, commit],
  );

  const handleModeChange = useCallback(
    (newMode: 'form' | 'yaml') => {
      if (newMode === mode) return;

      if (newMode === 'yaml') {
        setYamlContent(formToYaml(data));
        setYamlError(undefined);
      } else {
        try {
          const parsed = yamlToForm(yamlContent, namespaces, environments);
          commit({ ...data, ...parsed });
          setYamlError(undefined);
        } catch (err) {
          setYamlError(`Failed to parse YAML: ${err}`);
          return;
        }
      }
      setMode(newMode);
    },
    [mode, data, yamlContent, namespaces, environments, commit],
  );

  const handleYamlChange = useCallback(
    (content: string) => {
      setYamlContent(content);
      try {
        const parsed = yamlToForm(content, namespaces, environments);
        commit({ ...data, ...parsed });
        setYamlError(undefined);
      } catch (err) {
        setYamlError(`YAML parse error: ${err}`);
      }
    },
    [namespaces, environments, data, commit],
  );

  return (
    <div>
      <div className={classes.toggleContainer}>
        <FormYamlToggle value={mode} onChange={handleModeChange} />
      </div>

      {mode === 'form' ? (
        <div className={classes.formContainer}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <NamespaceSelectField
                value={data.namespace_name}
                onChange={v => updateField('namespace_name', v)}
                label="Namespace"
                helperText="Namespace where the notification channel will be created"
                required
                onNamespacesLoaded={ns => {
                  setNamespaces(ns);
                  if (!nsPreselectedRef.current && ns.length > 0) {
                    const current = formDataRef.current;
                    if (!current?.namespace_name) {
                      nsPreselectedRef.current = true;
                      const defaultNs = ns.find(n => n.name === 'default');
                      commit({
                        ...DEFAULT_FORM_DATA,
                        ...current,
                        namespace_name: (defaultNs ?? ns[0]).entityRef,
                      });
                    }
                  }
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Channel Name"
                value={data.channel_name}
                onChange={e => updateField('channel_name', e.target.value)}
                fullWidth
                variant="outlined"
                required
                error={
                  !!data.channel_name && !isValidK8sName(data.channel_name)
                }
                helperText={
                  data.channel_name && !isValidK8sName(data.channel_name)
                    ? 'Must be lowercase alphanumeric with hyphens, starting and ending with alphanumeric'
                    : 'Unique name for your notification channel'
                }
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Target Environment"
                value={data.environment}
                onChange={e => updateField('environment', e.target.value)}
                fullWidth
                variant="outlined"
                required
                disabled={loadingEnvironments || !data.namespace_name}
                helperText={
                  !data.namespace_name
                    ? 'Select a namespace first'
                    : 'The environment this channel is scoped to'
                }
              >
                {environments.map(env => (
                  <MenuItem key={env.entityRef} value={env.entityRef}>
                    {env.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Box display="flex" alignItems="center" height="100%">
                <Typography variant="body2" style={{ marginRight: 16 }}>
                  Environment Default
                </Typography>
                <Switch
                  checked={data.isEnvDefault}
                  onChange={e => updateField('isEnvDefault', e.target.checked)}
                  color="primary"
                />
              </Box>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Channel Type"
                value={data.type}
                onChange={e =>
                  updateField('type', e.target.value as 'email' | 'webhook')
                }
                fullWidth
                variant="outlined"
                required
              >
                <MenuItem value="email">Email</MenuItem>
                <MenuItem value="webhook">Webhook</MenuItem>
              </TextField>
            </Grid>

            {data.type === 'email' ? (
              <>
                <Grid item xs={12}>
                  <Typography className={classes.sectionTitle}>
                    Email Configuration
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="From Address"
                    value={data.emailConfig.from}
                    onChange={e => updateEmailField('from', e.target.value)}
                    fullWidth
                    variant="outlined"
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="To Addresses"
                    value={data.emailConfig.to.join(', ')}
                    onChange={e =>
                      updateEmailField(
                        'to',
                        e.target.value
                          .split(',')
                          .map(s => s.trim())
                          .filter(Boolean),
                      )
                    }
                    fullWidth
                    variant="outlined"
                    required
                    helperText="Comma-separated recipient email addresses"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="SMTP Host"
                    value={data.emailConfig.smtpHost}
                    onChange={e => updateEmailField('smtpHost', e.target.value)}
                    fullWidth
                    variant="outlined"
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="SMTP Port"
                    type="number"
                    value={data.emailConfig.smtpPort}
                    onChange={e =>
                      updateEmailField('smtpPort', Number(e.target.value))
                    }
                    fullWidth
                    variant="outlined"
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="SMTP Username Secret Name"
                    value={data.emailConfig.smtpUsernameSecretName}
                    onChange={e =>
                      updateEmailField('smtpUsernameSecretName', e.target.value)
                    }
                    fullWidth
                    variant="outlined"
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="SMTP Username Secret Key"
                    value={data.emailConfig.smtpUsernameSecretKey}
                    onChange={e =>
                      updateEmailField('smtpUsernameSecretKey', e.target.value)
                    }
                    fullWidth
                    variant="outlined"
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="SMTP Password Secret Name"
                    value={data.emailConfig.smtpPasswordSecretName}
                    onChange={e =>
                      updateEmailField('smtpPasswordSecretName', e.target.value)
                    }
                    fullWidth
                    variant="outlined"
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="SMTP Password Secret Key"
                    value={data.emailConfig.smtpPasswordSecretKey}
                    onChange={e =>
                      updateEmailField('smtpPasswordSecretKey', e.target.value)
                    }
                    fullWidth
                    variant="outlined"
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box display="flex" alignItems="center" height="100%">
                    <Typography variant="body2" style={{ marginRight: 16 }}>
                      Skip TLS Verification
                    </Typography>
                    <Switch
                      checked={data.emailConfig.insecureSkipVerify}
                      onChange={e =>
                        updateEmailField('insecureSkipVerify', e.target.checked)
                      }
                      color="primary"
                    />
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Subject Template"
                    value={data.emailConfig.subjectTemplate}
                    onChange={e =>
                      updateEmailField('subjectTemplate', e.target.value)
                    }
                    fullWidth
                    variant="outlined"
                    required
                    helperText="Supports CEL expressions, e.g. ${alertName}"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Body Template"
                    value={data.emailConfig.bodyTemplate}
                    onChange={e =>
                      updateEmailField('bodyTemplate', e.target.value)
                    }
                    fullWidth
                    variant="outlined"
                    required
                    multiline
                    minRows={4}
                    helperText="Supports CEL expressions, e.g. ${alertDescription}"
                  />
                </Grid>
              </>
            ) : (
              <>
                <Grid item xs={12}>
                  <Typography className={classes.sectionTitle}>
                    Webhook Configuration
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Webhook URL"
                    value={data.webhookConfig.url}
                    onChange={e => updateWebhookField('url', e.target.value)}
                    fullWidth
                    variant="outlined"
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <RjsfForm
                    schema={HEADERS_SCHEMA}
                    formData={{ headers: data.webhookConfig.headers }}
                    onChange={e =>
                      updateWebhookField('headers', e.formData?.headers ?? [])
                    }
                    tagName="div"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Payload Template"
                    value={data.webhookConfig.payloadTemplate}
                    onChange={e =>
                      updateWebhookField('payloadTemplate', e.target.value)
                    }
                    fullWidth
                    variant="outlined"
                    multiline
                    minRows={4}
                    helperText="Optional JSON payload template, supports CEL expressions like ${alertName}"
                  />
                </Grid>
              </>
            )}
          </Grid>
        </div>
      ) : (
        <div>
          <div className={classes.helpText}>
            <span>
              Edit the ObservabilityAlertsNotificationChannel CR YAML directly.
            </span>
          </div>
          <div className={classes.yamlContainer}>
            <YamlEditor
              content={yamlContent}
              onChange={handleYamlChange}
              errorText={yamlError}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export const NotificationChannelFormWithYamlSchema = {
  returnValue: {
    type: 'object' as const,
    properties: {
      namespace_name: { type: 'string' as const },
      channel_name: { type: 'string' as const },
      environment: { type: 'string' as const },
      isEnvDefault: { type: 'boolean' as const },
      type: { type: 'string' as const },
      emailConfig: { type: 'object' as const },
      webhookConfig: { type: 'object' as const },
    },
  },
};

export const notificationChannelFormWithYamlValidation = (
  value: NotificationChannelFormData,
  validation: FieldValidation,
) => {
  if (!value?.channel_name || value.channel_name.trim() === '') {
    validation.addError('Channel name is required');
  } else if (!isValidK8sName(value.channel_name)) {
    validation.addError(
      'Channel name must be lowercase alphanumeric with hyphens, starting and ending with alphanumeric',
    );
  }
  if (!value?.namespace_name || value.namespace_name.trim() === '') {
    validation.addError('Namespace is required');
  }
  if (!value?.environment || value.environment.trim() === '') {
    validation.addError('Target environment is required');
  }
  if (value?.type === 'email') {
    if (!value.emailConfig?.from) {
      validation.addError('Email "from" address is required');
    } else if (!isValidEmail(value.emailConfig.from)) {
      validation.addError('Email "from" address must be a valid email address');
    }
    if (!value.emailConfig?.to || value.emailConfig.to.length === 0) {
      validation.addError('At least one "to" address is required');
    } else if (value.emailConfig.to.some(addr => !isValidEmail(addr))) {
      validation.addError('All "to" addresses must be valid email addresses');
    }
    if (!value.emailConfig?.smtpHost) {
      validation.addError('SMTP host is required');
    }
    if (
      !Number.isInteger(value.emailConfig?.smtpPort) ||
      (value.emailConfig?.smtpPort ?? 0) < 1 ||
      (value.emailConfig?.smtpPort ?? 0) > 65535
    ) {
      validation.addError('SMTP port must be between 1 and 65535');
    }
    if (!value.emailConfig?.smtpUsernameSecretName) {
      validation.addError('SMTP username secret name is required');
    }
    if (!value.emailConfig?.smtpUsernameSecretKey) {
      validation.addError('SMTP username secret key is required');
    }
    if (!value.emailConfig?.smtpPasswordSecretName) {
      validation.addError('SMTP password secret name is required');
    }
    if (!value.emailConfig?.smtpPasswordSecretKey) {
      validation.addError('SMTP password secret key is required');
    }
    if (!value.emailConfig?.subjectTemplate) {
      validation.addError('Subject template is required');
    }
    if (!value.emailConfig?.bodyTemplate) {
      validation.addError('Body template is required');
    }
  }
  if (value?.type === 'webhook') {
    if (!value.webhookConfig?.url) {
      validation.addError('Webhook URL is required');
    } else if (!isValidAbsoluteUri(value.webhookConfig.url)) {
      validation.addError(
        'Webhook URL must be a valid absolute URI (e.g. https://example.com/webhook)',
      );
    }
    const headers = value.webhookConfig?.headers ?? [];
    const headerNames = headers
      .map(header => header.name?.trim())
      .filter((name): name is string => Boolean(name));
    if (new Set(headerNames).size !== headerNames.length) {
      validation.addError('Webhook header names must be unique');
    }
    if (
      headers.some(header => {
        const hasSecretName = Boolean(header.secretName);
        const hasSecretKey = Boolean(header.secretKey);
        return (
          hasSecretName !== hasSecretKey ||
          (!header.value && !(hasSecretName && hasSecretKey))
        );
      })
    ) {
      validation.addError(
        'Each webhook header must provide either "value" or both "secretName" and "secretKey"',
      );
    }
  }
};
