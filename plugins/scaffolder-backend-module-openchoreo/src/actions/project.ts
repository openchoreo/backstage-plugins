import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { createOpenChoreoApiClient } from '@openchoreo/openchoreo-client-node';
import { Config } from '@backstage/config';
import { z } from 'zod';

export const createProjectAction = (config: Config) => {
  return createTemplateAction({
    id: 'openchoreo:project:create',
    description: 'Create OpenChoreo Project',
    schema: {
      input: (zImpl: typeof z) =>
        zImpl.object({
          orgName: zImpl
            .string()
            .describe('The name of the organization to create the project in'),
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
          organizationName: zImpl
            .string()
            .describe('The organization where the project was created'),
        }),
    },
    async handler(ctx) {
      ctx.logger.debug(
        `Creating project with parameters: ${JSON.stringify(ctx.input)}`,
      );

      // Extract organization name from domain format (e.g., "domain:default/default-org" -> "default-org")
      const extractOrgName = (fullOrgName: string): string => {
        const parts = fullOrgName.split('/');
        return parts[parts.length - 1];
      };

      const orgName = extractOrgName(ctx.input.orgName);
      ctx.logger.debug(
        `Extracted organization name: ${orgName} from ${ctx.input.orgName}`,
      );

      // Get the base URL from configuration
      const baseUrl = config.getString('openchoreo.baseUrl');

      // Check if authorization is enabled (defaults to true)
      const authzEnabled =
        config.getOptionalBoolean('openchoreo.features.authz.enabled') ?? true;

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
          '/orgs/{orgName}/projects',
          {
            params: {
              path: { orgName },
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

        // Set outputs for the scaffolder
        ctx.output('projectName', data.data.name || ctx.input.projectName);
        ctx.output('organizationName', orgName);
      } catch (error) {
        ctx.logger.error(`Error creating project: ${error}`);
        throw new Error(`Failed to create project: ${error}`);
      }
    },
  });
};
