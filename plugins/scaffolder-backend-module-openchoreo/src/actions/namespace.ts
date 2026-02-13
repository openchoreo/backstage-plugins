import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { createOpenChoreoApiClient } from '@openchoreo/openchoreo-client-node';
import { Config } from '@backstage/config';
import { z } from 'zod';
import {
  type ImmediateCatalogService,
  translateNamespaceToDomainEntity,
} from '@openchoreo/backstage-plugin-catalog-backend-module';

export const createNamespaceAction = (
  config: Config,
  immediateCatalog: ImmediateCatalogService,
) => {
  return createTemplateAction({
    id: 'openchoreo:namespace:create',
    description: 'Create OpenChoreo Namespace',
    schema: {
      input: (zImpl: typeof z) =>
        zImpl.object({
          namespaceName: zImpl
            .string()
            .describe('The name of the namespace to create'),
          displayName: zImpl
            .string()
            .optional()
            .describe('The display name of the namespace'),
          description: zImpl
            .string()
            .optional()
            .describe('The description of the namespace'),
        }),
      output: (zImpl: typeof z) =>
        zImpl.object({
          namespaceName: zImpl
            .string()
            .describe('The name of the created namespace'),
          entityRef: zImpl
            .string()
            .describe('Entity reference for the created namespace'),
        }),
    },
    async handler(ctx) {
      ctx.logger.debug(
        `Creating namespace with parameters: ${JSON.stringify(ctx.input)}`,
      );

      const namespaceName = ctx.input.namespaceName;

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

      if (token) {
        ctx.logger.debug('Using user token from secrets for OpenChoreo API');
      } else {
        ctx.logger.debug(
          'Authorization disabled - calling OpenChoreo API without auth',
        );
      }

      const client = createOpenChoreoApiClient({
        baseUrl,
        token,
        logger: ctx.logger,
      });

      try {
        const { data, error, response } = await client.POST('/namespaces', {
          body: {
            name: namespaceName,
            displayName: ctx.input.displayName,
            description: ctx.input.description,
          },
        });

        if (error || !response.ok) {
          throw new Error(
            `Failed to create namespace: ${response.status} ${response.statusText}`,
          );
        }

        if (!data?.success || !data?.data) {
          throw new Error('API request was not successful');
        }

        ctx.logger.debug(
          `Namespace created successfully: ${JSON.stringify(data.data)}`,
        );

        const resultName = data.data.name || namespaceName;

        // Immediately insert the namespace into the catalog as a Domain entity
        try {
          ctx.logger.info(
            `Inserting namespace '${resultName}' into catalog immediately...`,
          );

          const defaultOwner =
            config.getOptionalString('openchoreo.defaultOwner') ||
            'openchoreo-users';

          const entity = translateNamespaceToDomainEntity(
            {
              name: resultName,
              displayName: ctx.input.displayName || data.data.displayName,
              description: ctx.input.description || data.data.description,
              createdAt: data.data.createdAt || new Date().toISOString(),
              status: data.data.status,
            },
            {
              locationKey: 'OpenChoreoEntityProvider',
              defaultOwner: `group:default/${defaultOwner}`,
            },
          );

          await immediateCatalog.insertEntity(entity);

          ctx.logger.info(
            `Namespace '${resultName}' successfully added to catalog`,
          );
        } catch (catalogError) {
          ctx.logger.error(
            `Failed to immediately add namespace to catalog: ${catalogError}. ` +
              `Namespace will be visible after the next scheduled catalog sync.`,
          );
        }

        // Set outputs for the scaffolder
        ctx.output('namespaceName', resultName);
        ctx.output('entityRef', `domain:default/${resultName}`);
      } catch (err) {
        ctx.logger.error(`Error creating namespace: ${err}`);
        throw new Error(`Failed to create namespace: ${err}`);
      }
    },
  });
};
