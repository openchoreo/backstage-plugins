import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { createOpenChoreoApiClient } from '@openchoreo/openchoreo-client-node';
import { Config } from '@backstage/config';
import { z } from 'zod';
import {
  type ImmediateCatalogService,
  translateProjectToEntity,
} from '@openchoreo/backstage-plugin-catalog-backend-module';

export const createProjectAction = (
  config: Config,
  immediateCatalog: ImmediateCatalogService,
) => {
  return createTemplateAction({
    id: 'openchoreo:project:create',
    description: 'Create OpenChoreo Project',
    schema: {
      input: (zImpl: typeof z) =>
        zImpl.object({
          namespaceName: zImpl
            .string()
            .describe('The name of the namespace to create the project in'),
          projectName: zImpl
            .string()
            .describe('The name of the project to create'),
          displayName: zImpl
            .string()
            .optional()
            .describe('The display name of the project'),
          description: zImpl
            .string()
            .optional()
            .describe('The description of the project'),
          deploymentPipeline: zImpl
            .string()
            .optional()
            .describe('The deployment pipeline for the project'),
        }),
      output: (zImpl: typeof z) =>
        zImpl.object({
          projectName: zImpl
            .string()
            .describe('The name of the created project'),
          namespaceName: zImpl
            .string()
            .describe('The namespace where the project was created'),
          entityRef: zImpl
            .string()
            .describe('Entity reference for the created project'),
        }),
    },
    async handler(ctx) {
      ctx.logger.debug(
        `Creating project with parameters: ${JSON.stringify(ctx.input)}`,
      );

      // Extract namespace name from domain format (e.g., "domain:default/default-ns" -> "default-ns")
      const extractNamespaceName = (fullNamespaceName: string): string => {
        const parts = fullNamespaceName.split('/');
        return parts[parts.length - 1];
      };

      const namespaceName = extractNamespaceName(ctx.input.namespaceName);
      ctx.logger.debug(
        `Extracted namespace name: ${namespaceName} from ${ctx.input.namespaceName}`,
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
        const { data, error, response } = await client.POST(
          '/namespaces/{namespaceName}/projects',
          {
            params: {
              path: { namespaceName },
            },
            body: {
              name: ctx.input.projectName,
              displayName: ctx.input.displayName,
              description: ctx.input.description,
              deploymentPipeline: ctx.input.deploymentPipeline,
            },
          },
        );

        if (error || !response.ok) {
          throw new Error(
            `Failed to create project: ${response.status} ${response.statusText}`,
          );
        }

        if (!data.success || !data.data) {
          throw new Error('API request was not successful');
        }

        ctx.logger.debug(
          `Project created successfully: ${JSON.stringify(data.data)}`,
        );

        const projectName = data.data.name || ctx.input.projectName;

        // Immediately insert the project into the catalog
        try {
          ctx.logger.info(
            `Inserting project '${projectName}' into catalog immediately...`,
          );

          const defaultOwner =
            config.getOptionalString('openchoreo.defaultOwner') ||
            'openchoreo-users';

          const entity = translateProjectToEntity(
            {
              name: projectName,
              displayName: ctx.input.displayName || data.data.displayName,
              description: ctx.input.description || data.data.description,
              namespaceName: namespaceName,
              uid: data.data.uid,
            },
            namespaceName,
            {
              locationKey: 'provider:OpenChoreoEntityProvider',
              defaultOwner: `group:default/${defaultOwner}`,
            },
          );

          await immediateCatalog.insertEntity(entity);

          ctx.logger.info(
            `Project '${projectName}' successfully added to catalog`,
          );
        } catch (catalogError) {
          ctx.logger.error(
            `Failed to immediately add project to catalog: ${catalogError}. ` +
              `Project will be visible after the next scheduled catalog sync.`,
          );
        }

        // Set outputs for the scaffolder
        ctx.output('projectName', projectName);
        ctx.output('namespaceName', namespaceName);
        ctx.output('entityRef', `system:${namespaceName}/${projectName}`);
      } catch (error) {
        ctx.logger.error(`Error creating project: ${error}`);
        throw new Error(`Failed to create project: ${error}`);
      }
    },
  });
};
