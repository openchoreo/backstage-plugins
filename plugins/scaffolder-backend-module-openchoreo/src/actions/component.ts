import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { createOpenChoreoApiClient } from '@openchoreo/openchoreo-client-node';
import { Config } from '@backstage/config';
import { z } from 'zod';

export const createComponentAction = (config: Config) => {
  return createTemplateAction({
    id: 'openchoreo:component:create',
    description: 'Create OpenChoreo Component',
    schema: {
      input: (zImpl: typeof z) =>
        zImpl.object({
          orgName: zImpl
            .string()
            .describe(
              'The name of the organization where the component will be created',
            ),
          projectName: zImpl
            .string()
            .describe(
              'The name of the project where the component will be created',
            ),
          componentName: zImpl
            .string()
            .describe('The name of the component to create'),
          displayName: zImpl
            .string()
            .optional()
            .describe('The display name of the component'),
          description: zImpl
            .string()
            .optional()
            .describe('The description of the component'),
          componentType: zImpl
            .string()
            .describe(
              'The type of the component (e.g., Service, WebApp, ScheduledTask, APIProxy)',
            ),
          useBuiltInCI: zImpl
            .boolean()
            .optional()
            .describe('Whether to use built-in CI in OpenChoreo'),
          repoUrl: zImpl
            .string()
            .optional()
            .describe(
              'The URL of the repository containing the component source code',
            ),
          branch: zImpl
            .string()
            .optional()
            .describe('The branch of the repository to use'),
          componentPath: zImpl
            .string()
            .optional()
            .describe(
              'The path within the repository where the component source code is located',
            ),
          buildTemplateName: zImpl
            .string()
            .optional()
            .describe(
              'The name of the build template to use (e.g., java-maven, nodejs-npm)',
            ),
          buildParameters: zImpl
            .record(zImpl.any())
            .optional()
            .describe('Parameters specific to the selected build template'),
        }),
      output: (zImpl: typeof z) =>
        zImpl.object({
          componentName: zImpl
            .string()
            .describe('The name of the created component'),
          projectName: zImpl
            .string()
            .describe('The project where the component was created'),
          organizationName: zImpl
            .string()
            .describe('The organization where the component was created'),
        }),
    },
    async handler(ctx) {
      ctx.logger.debug(
        `Creating component with parameters: ${JSON.stringify(ctx.input)}`,
      );

      // Extract organization name from domain format (e.g., "domain:default/default-org" -> "default-org")
      const extractOrgName = (fullOrgName: string): string => {
        const parts = fullOrgName.split('/');
        return parts[parts.length - 1];
      };

      // Extract project name from system format (e.g., "system:default/project-name" -> "project-name")
      const extractProjectName = (fullProjectName: string): string => {
        const parts = fullProjectName.split('/');
        return parts[parts.length - 1];
      };

      const orgName = extractOrgName(ctx.input.orgName);
      const projectName = extractProjectName(ctx.input.projectName);

      ctx.logger.debug(
        `Extracted organization name: ${orgName} from ${ctx.input.orgName}`,
      );
      ctx.logger.debug(
        `Extracted project name: ${projectName} from ${ctx.input.projectName}`,
      );

      // Get the base URL from configuration
      const baseUrl = config.getString('openchoreo.baseUrl');

      // Create a new instance of the OpenChoreo API client using the generated client
      const client = createOpenChoreoApiClient({
        baseUrl,
        logger: ctx.logger,
      });

      // Build configuration for built-in CI
      let buildConfig = undefined;
      if (
        ctx.input.useBuiltInCI &&
        ctx.input.repoUrl &&
        ctx.input.branch &&
        ctx.input.componentPath &&
        ctx.input.buildTemplateName
      ) {
        // Convert buildParameters object to array of TemplateParameter
        let buildTemplateParams = undefined;
        if (
          ctx.input.buildParameters &&
          Object.keys(ctx.input.buildParameters).length > 0
        ) {
          buildTemplateParams = Object.entries(ctx.input.buildParameters).map(
            ([name, value]) => ({
              name,
              value: String(value),
            }),
          );
        }

        buildConfig = {
          repoUrl: ctx.input.repoUrl,
          repoBranch: ctx.input.branch,
          componentPath: ctx.input.componentPath,
          buildTemplateRef: ctx.input.buildTemplateName,
          buildTemplateParams,
        };
        ctx.logger.debug(
          `Build configuration created: ${JSON.stringify(buildConfig)}`,
        );
      }

      try {
        const { data, error, response } = await client.POST(
          '/orgs/{orgName}/projects/{projectName}/components',
          {
            params: {
              path: { orgName, projectName },
            },
            body: {
              name: ctx.input.componentName,
              displayName: ctx.input.displayName,
              description: ctx.input.description,
              type: ctx.input.componentType,
              buildConfig,
            },
          },
        );

        if (error || !response.ok) {
          throw new Error(
            `Failed to create component: ${response.status} ${response.statusText}`,
          );
        }

        if (!data.success || !data.data) {
          throw new Error('API request was not successful');
        }

        ctx.logger.debug(
          `Component created successfully: ${JSON.stringify(data.data)}`,
        );

        // Set outputs for the scaffolder
        ctx.output('componentName', data.data.name || ctx.input.componentName);
        ctx.output('projectName', projectName);
        ctx.output('organizationName', orgName);
      } catch (error) {
        ctx.logger.error(`Error creating component: ${error}`);
        throw new Error(`Failed to create component: ${error}`);
      }
    },
  });
};
