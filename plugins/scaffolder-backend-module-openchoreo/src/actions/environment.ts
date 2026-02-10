import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { createOpenChoreoApiClient } from '@openchoreo/openchoreo-client-node';
import { Config } from '@backstage/config';
import { z } from 'zod';

export const createEnvironmentAction = (config: Config) => {
  return createTemplateAction({
    id: 'openchoreo:environment:create',
    description: 'Create OpenChoreo Environment',
    schema: {
      input: (zImpl: typeof z) =>
        zImpl.object({
          namespaceName: zImpl
            .string()
            .describe(
              'The name of the namespace to create the environment in',
            ),
          environmentName: zImpl
            .string()
            .describe('The name of the environment to create'),
          displayName: zImpl
            .string()
            .optional()
            .describe('The display name of the environment'),
          description: zImpl
            .string()
            .optional()
            .describe('The description of the environment'),
          dataPlaneRef: zImpl
            .string()
            .optional()
            .describe('Reference to the data plane for this environment'),
          isProduction: zImpl
            .boolean()
            .describe('Whether this is a production environment'),
          dnsPrefix: zImpl
            .string()
            .optional()
            .describe('DNS prefix for the environment gateway'),
        }),
      output: (zImpl: typeof z) =>
        zImpl.object({
          environmentName: zImpl
            .string()
            .describe('The name of the created environment'),
          namespaceName: zImpl
            .string()
            .describe('The namespace where the environment was created'),
        }),
    },
    async handler(ctx) {
      ctx.logger.debug(
        `Creating environment with parameters: ${JSON.stringify(ctx.input)}`,
      );

      // Extract entity name from entity reference format (e.g., "domain:default/default-ns" -> "default-ns")
      const extractEntityName = (entityRef: string): string => {
        const parts = entityRef.split('/');
        return parts[parts.length - 1];
      };

      const namespaceName = extractEntityName(ctx.input.namespaceName);
      ctx.logger.debug(
        `Extracted namespace name: ${namespaceName} from ${ctx.input.namespaceName}`,
      );

      // Extract dataplane name from entity reference format (e.g., "dataplane:default/default" -> "default")
      const dataPlaneRef = ctx.input.dataPlaneRef
        ? extractEntityName(ctx.input.dataPlaneRef)
        : undefined;
      ctx.logger.debug(
        `Extracted dataplane ref: ${dataPlaneRef} from ${ctx.input.dataPlaneRef}`,
      );

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
          'User authentication token not available. Please ensure you are logged in.',
        );
      }

      const client = createOpenChoreoApiClient({
        baseUrl,
        token,
        logger: ctx.logger,
      });

      try {
        const { data, error, response } = await client.POST(
          '/namespaces/{namespaceName}/environments',
          {
            params: {
              path: { namespaceName },
            },
            body: {
              name: ctx.input.environmentName,
              displayName: ctx.input.displayName,
              description: ctx.input.description,
              dataPlaneRef,
              isProduction: ctx.input.isProduction,
              dnsPrefix: ctx.input.dnsPrefix,
            },
          },
        );

        if (error || !response.ok) {
          throw new Error(
            `Failed to create environment: ${response.status} ${response.statusText}`,
          );
        }

        if (!data.success || !data.data) {
          throw new Error('API request was not successful');
        }

        ctx.logger.debug(
          `Environment created successfully: ${JSON.stringify(data.data)}`,
        );

        ctx.output(
          'environmentName',
          data.data.name || ctx.input.environmentName,
        );
        ctx.output('namespaceName', namespaceName);
      } catch (err) {
        ctx.logger.error(`Error creating environment: ${err}`);
        throw new Error(`Failed to create environment: ${err}`);
      }
    },
  });
};
