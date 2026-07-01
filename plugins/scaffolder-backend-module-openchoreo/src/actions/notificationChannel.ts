import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import {
  createOpenChoreoApiClient,
  assertApiResponse,
} from '@openchoreo/openchoreo-client-node';
import { Config } from '@backstage/config';
import {
  type ImmediateCatalogService,
  translateNotificationChannelToEntity,
} from '@openchoreo/backstage-plugin-catalog-backend-module';

export const createNotificationChannelAction = (
  config: Config,
  immediateCatalog: ImmediateCatalogService,
) => {
  return createTemplateAction({
    id: 'openchoreo:notificationchannel:create',
    description: 'Create OpenChoreo Notification Channel',
    schema: {
      input: {
        namespaceName: z =>
          z.string({
            description:
              'The name of the namespace to create the notification channel in',
          }),
        channelName: z =>
          z.string({
            description: 'The name of the notification channel to create',
          }),
        environment: z =>
          z.string({
            description: 'Reference to the target environment for this channel',
          }),
        isEnvDefault: z =>
          z
            .boolean({
              description:
                'Whether this is the default notification channel for the environment',
            })
            .optional(),
        type: z =>
          z.enum(['email', 'webhook'], {
            description: 'The notification channel type',
          }),
        emailConfig: z =>
          z
            .object({
              from: z.string(),
              to: z.array(z.string()),
              smtpHost: z.string(),
              smtpPort: z.number(),
              smtpUsernameSecretName: z.string(),
              smtpUsernameSecretKey: z.string(),
              smtpPasswordSecretName: z.string(),
              smtpPasswordSecretKey: z.string(),
              insecureSkipVerify: z.boolean().optional(),
              subjectTemplate: z.string(),
              bodyTemplate: z.string(),
            })
            .optional(),
        webhookConfig: z =>
          z
            .object({
              url: z.string(),
              headers: z
                .array(
                  z.object({
                    name: z.string(),
                    value: z.string().optional(),
                    secretName: z.string().optional(),
                    secretKey: z.string().optional(),
                  }),
                )
                .optional(),
              payloadTemplate: z.string().optional(),
            })
            .optional(),
      },
      output: {
        channelName: z =>
          z.string({
            description: 'The name of the created notification channel',
          }),
        namespaceName: z =>
          z.string({
            description:
              'The namespace where the notification channel was created',
          }),
        entityRef: z =>
          z.string({
            description:
              'Entity reference for the created notification channel',
          }),
      },
    },
    async handler(ctx) {
      ctx.logger.debug(
        `Creating notification channel '${ctx.input.channelName}' of type '${ctx.input.type}'`,
      );

      // Extract entity name from entity reference format (e.g., "domain:default/default-ns" -> "default-ns")
      const extractEntityName = (entityRef: string): string => {
        const parts = entityRef.split('/');
        return parts[parts.length - 1];
      };

      const namespaceName = extractEntityName(ctx.input.namespaceName);
      const environmentName = extractEntityName(ctx.input.environment);

      const { emailConfig: emailInput, webhookConfig: webhookInput } =
        ctx.input;

      if (ctx.input.type === 'email' && !emailInput) {
        throw new Error('emailConfig is required when type is "email".');
      }
      if (ctx.input.type === 'webhook' && !webhookInput) {
        throw new Error('webhookConfig is required when type is "webhook".');
      }
      if (
        webhookInput?.headers?.some(
          header =>
            Boolean(header.secretName) !== Boolean(header.secretKey) ||
            (header.value === undefined &&
              !(header.secretName && header.secretKey)),
        )
      ) {
        throw new Error(
          'Each webhook header must provide either `value` or both `secretName` and `secretKey`.',
        );
      }

      const emailConfig =
        ctx.input.type === 'email' && emailInput
          ? {
              from: emailInput.from,
              to: emailInput.to,
              smtp: {
                host: emailInput.smtpHost,
                port: emailInput.smtpPort,
                auth: {
                  username: {
                    secretKeyRef: {
                      name: emailInput.smtpUsernameSecretName,
                      key: emailInput.smtpUsernameSecretKey,
                    },
                  },
                  password: {
                    secretKeyRef: {
                      name: emailInput.smtpPasswordSecretName,
                      key: emailInput.smtpPasswordSecretKey,
                    },
                  },
                },
                tls: {
                  insecureSkipVerify: emailInput.insecureSkipVerify ?? false,
                },
              },
              template: {
                subject: emailInput.subjectTemplate,
                body: emailInput.bodyTemplate,
              },
            }
          : undefined;

      const webhookConfig =
        ctx.input.type === 'webhook' && webhookInput
          ? {
              url: webhookInput.url,
              ...(webhookInput.headers &&
                webhookInput.headers.length > 0 && {
                  headers: Object.fromEntries(
                    webhookInput.headers.map(header => [
                      header.name,
                      header.secretName && header.secretKey
                        ? {
                            valueFrom: {
                              secretKeyRef: {
                                name: header.secretName,
                                key: header.secretKey,
                              },
                            },
                          }
                        : { value: header.value },
                    ]),
                  ),
                }),
              ...(webhookInput.payloadTemplate && {
                payloadTemplate: webhookInput.payloadTemplate,
              }),
            }
          : undefined;

      // Get the base URL from configuration
      const baseUrl = config.getString('openchoreo.baseUrl');

      // Check if authorization is enabled (defaults to true)
      const authzEnabled =
        config.getOptionalBoolean('openchoreo.features.auth.enabled') ?? true;

      // Get user token from secrets (injected by form decorator) when authz is enabled
      const token = authzEnabled
        ? ctx.secrets?.OPENCHOREO_USER_TOKEN
        : undefined;

      if (authzEnabled && !token) {
        throw new Error(
          'User authentication token not available. Ensure you are logged in.',
        );
      }

      const client = createOpenChoreoApiClient({
        baseUrl,
        token,
        logger: ctx.logger,
      });

      try {
        const { data, error, response } = await client.POST(
          '/api/v1/namespaces/{namespaceName}/observabilityalertsnotificationchannels',
          {
            params: {
              path: { namespaceName },
            },
            body: {
              metadata: {
                name: ctx.input.channelName,
              },
              spec: {
                environment: environmentName,
                isEnvDefault: ctx.input.isEnvDefault ?? false,
                type: ctx.input.type,
                ...(emailConfig && { emailConfig }),
                ...(webhookConfig && { webhookConfig }),
              },
            },
          },
        );

        assertApiResponse(
          { data, error, response },
          'create notification channel',
        );

        const channelName = data?.metadata?.name || ctx.input.channelName;

        ctx.logger.debug(
          `Notification channel '${channelName}' created successfully`,
        );

        // Immediately insert the notification channel into the catalog
        try {
          ctx.logger.info(
            `Inserting notification channel '${channelName}' into catalog immediately...`,
          );

          const entity = translateNotificationChannelToEntity(
            {
              name: channelName,
              environment: data?.spec?.environment ?? environmentName,
              isEnvDefault:
                data?.spec?.isEnvDefault ?? ctx.input.isEnvDefault ?? false,
              type: (data?.spec?.type ?? ctx.input.type) as 'email' | 'webhook',
              emailConfig: data?.spec?.emailConfig ?? emailConfig,
              webhookConfig: data?.spec?.webhookConfig ?? webhookConfig,
              createdAt:
                data?.metadata?.creationTimestamp || new Date().toISOString(),
            },
            namespaceName,
            {
              locationKey: 'provider:OpenChoreoEntityProvider',
            },
          );

          await immediateCatalog.insertEntity(entity);

          ctx.logger.info(
            `Notification channel '${channelName}' successfully added to catalog`,
          );
        } catch (catalogError) {
          ctx.logger.error(
            `Failed to immediately add notification channel to catalog: ${catalogError}. ` +
              `Notification channel will be visible after the next scheduled catalog sync.`,
          );
        }

        ctx.output('channelName', channelName);
        ctx.output('namespaceName', namespaceName);
        ctx.output(
          'entityRef',
          `observabilityalertsnotificationchannel:${namespaceName}/${channelName}`,
        );
      } catch (err) {
        ctx.logger.error(`Error creating notification channel: ${err}`);
        throw err instanceof Error
          ? err
          : new Error(`Failed to create notification channel: ${String(err)}`);
      }
    },
  });
};
