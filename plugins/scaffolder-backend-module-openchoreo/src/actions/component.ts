import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { createOpenChoreoApiClient } from '@openchoreo/openchoreo-client-node';
import { Config } from '@backstage/config';
import { z } from 'zod';
import { buildComponentResource } from './componentResourceBuilder';

export const createComponentAction = (config: Config) => {
  return createTemplateAction({
    id: 'openchoreo:component:create',
    description: 'Create OpenChoreo Component',
    schema: {
      input: (zImpl: typeof z) =>
        zImpl.object({
          // Keep existing validation for required fields
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
            .describe('The type of the component'),

          // Optional field
          useBuiltInCI: zImpl.boolean().optional(),
        })
        .passthrough(), // Allow any additional fields (CTD params, workflow params, addons, etc.)
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
      ctx.logger.info(
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

      ctx.logger.info(
        `Extracted organization name: ${orgName} from ${ctx.input.orgName}`,
      );
      ctx.logger.info(
        `Extracted project name: ${projectName} from ${ctx.input.projectName}`,
      );

      try {
        // Filter out UI-specific fields from addons (id, schema)
        const cleanedAddons = (ctx.input as any).addons?.map((addon: any) => ({
          name: addon.name,
          instanceName: addon.instanceName,
          config: addon.config,
        }));

        // Extract CTD-specific parameters by filtering out known scaffolder fields
        const knownScaffolderFields = new Set([
          'orgName',
          'projectName',
          'componentName',
          'displayName',
          'description',
          'componentType',
          'useBuiltInCI',
          'workflow_name',
          'workflow_parameters',
          'addons',
          'external_ci_note',
          'repo_url',
          'branch',
          'component_path',
          'component_type_workload_type',
        ]);

        const ctdParameters: Record<string, any> = {};
        for (const [key, value] of Object.entries(ctx.input)) {
          if (!knownScaffolderFields.has(key)) {
            ctdParameters[key] = value;
          }
        }

        ctx.logger.debug(
          `Extracted CTD parameters: ${JSON.stringify(ctdParameters)}`,
        );

        // Build the ComponentResource from form input
        const componentResource = buildComponentResource({
          componentName: ctx.input.componentName,
          displayName: ctx.input.displayName,
          description: ctx.input.description,
          organizationName: orgName,
          projectName: projectName,
          componentType: ctx.input.componentType,
          componentTypeWorkloadType: (ctx.input as any).component_type_workload_type || 'deployment',
          ctdParameters: ctdParameters,
          useBuiltInCI: ctx.input.useBuiltInCI,
          repoUrl: (ctx.input as any).repo_url,
          branch: (ctx.input as any).branch,
          componentPath: (ctx.input as any).component_path,
          workflowName: (ctx.input as any).workflow_name,
          workflowParameters: (ctx.input as any).workflow_parameters,
          addons: cleanedAddons,
        });

        // Log the generated ComponentResource object
        ctx.logger.info('Generated ComponentResource:');
        console.log('='.repeat(80));
        console.log('COMPONENT RESOURCE JSON:');
        console.log('='.repeat(80));
        console.log(JSON.stringify(componentResource, null, 2));
        console.log('='.repeat(80));

        // Create the API client using the auto-generated client
        const baseUrl = config.getString('openchoreo.baseUrl');
        const client = createOpenChoreoApiClient({
          baseUrl,
          logger: ctx.logger,
        });

        ctx.logger.debug(`Invoking /apply resource for component: ${componentResource.metadata.name}`);

        // Call the apply API to create the component
        const { data: applyData, error: applyError, response: applyResponse } = await client.POST('/apply', {
          body: componentResource as any,
        });

        if (applyError || !applyResponse.ok) {
          throw new Error(
            `Failed to create component: ${applyResponse.status} ${applyResponse.statusText}`,
          );
        }

        if (!applyData?.success) {
          throw new Error('API request was not successful');
        }

        ctx.logger.info(
          `Component created successfully via /apply: ${JSON.stringify(applyData)}`,
        );

        // Set outputs for the scaffolder
        ctx.output('componentName', ctx.input.componentName);
        ctx.output('projectName', projectName);
        ctx.output('organizationName', orgName);

        ctx.logger.info(
          `Component '${ctx.input.componentName}' created successfully in project '${projectName}'`,
        );
      } catch (error) {
        ctx.logger.error(`Error creating component: ${error}`);
        throw new Error(`Failed to create component: ${error}`);
      }
    },
  });
};
