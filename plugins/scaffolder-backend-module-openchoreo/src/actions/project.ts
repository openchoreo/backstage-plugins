import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { createOpenChoreoApiClient } from '@openchoreo/openchoreo-client-node';
import { Config } from '@backstage/config';
import { z } from 'zod';
import type { OpenChoreoTokenService } from '@openchoreo/openchoreo-auth';

export const createProjectAction = (
  config: Config,
  tokenService: OpenChoreoTokenService,
) => {
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

      // Get authentication token
      // Prefer user token from secrets (injected by form decorator) for user-based authorization
      // Fall back to service token if user token is not available
      let token: string | undefined;
      const userToken = ctx.secrets?.OPENCHOREO_USER_TOKEN;

      if (userToken) {
        token = userToken;
        ctx.logger.debug('Using user token from secrets for OpenChoreo API');
      } else if (tokenService.hasServiceCredentials()) {
        try {
          token = await tokenService.getServiceToken();
          ctx.logger.debug('Falling back to service token for OpenChoreo API');
        } catch (error) {
          ctx.logger.warn(`Failed to get service token: ${error}`);
        }
      }

      // Create a new instance of the OpenChoreo API client using the generated client
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
