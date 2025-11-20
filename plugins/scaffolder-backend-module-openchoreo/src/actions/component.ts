import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { createOpenChoreoApiClient } from '@openchoreo/openchoreo-client-node';
import { Config } from '@backstage/config';
import { z } from 'zod';
import { buildComponentResource } from './componentResourceBuilder';
import { CatalogClient } from '@backstage/catalog-client';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

// Kubernetes DNS subdomain name validation
const K8S_NAME_PATTERN =
  /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;
const MAX_NAME_LENGTH = 253;

export const createComponentAction = (config: Config) => {
  return createTemplateAction({
    id: 'openchoreo:component:create',
    description: 'Create OpenChoreo Component',
    schema: {
      input: (zImpl: typeof z) =>
        zImpl
          .object({
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
              .max(
                MAX_NAME_LENGTH,
                `Component name must not exceed ${MAX_NAME_LENGTH} characters`,
              )
              .regex(
                K8S_NAME_PATTERN,
                'Component name must be a valid Kubernetes name: lowercase letters, numbers, hyphens, or dots only. Must start and end with an alphanumeric character.',
              )
              .describe('The name of the component to create'),
            displayName: zImpl
              .string()
              .optional()
              .describe('The display name of the component'),
            description: zImpl
              .string()
              .optional()
              .describe('The description of the component'),
            componentType: zImpl.string().describe('The type of the component'),

            // Optional field
            useBuiltInCI: zImpl.boolean().optional(),
          })
          .passthrough(), // Allow any additional fields (CTD params, workflow params, traits, etc.)
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

      // Check if component with the same name already exists in this organization
      // Note: This requires catalog-backend to be accessible
      try {
        const backstageUrl = config.getString('backend.baseUrl');
        const catalogApi = new CatalogClient({
          discoveryApi: {
            async getBaseUrl(pluginId: string) {
              return `${backstageUrl}/api/${pluginId}`;
            },
          },
        });

        // Get all components from catalog
        const { items } = await catalogApi.getEntities({
          filter: {
            kind: 'Component',
          },
        });

        // Filter components by organization annotation and check if name exists
        const existsInOrg = items.some(
          component =>
            component.metadata.annotations?.[
              CHOREO_ANNOTATIONS.ORGANIZATION
            ] === orgName &&
            component.metadata.name === ctx.input.componentName,
        );

        if (existsInOrg) {
          throw new Error(
            `A component named "${ctx.input.componentName}" already exists in organization "${orgName}". Please choose a different name.`,
          );
        }

        ctx.logger.debug(
          `Component name "${ctx.input.componentName}" is available in organization "${orgName}"`,
        );
      } catch (error) {
        // If it's our duplicate error, rethrow it
        if (
          error instanceof Error &&
          error.message.includes('already exists')
        ) {
          throw error;
        }
        // For other catalog API errors, log warning but continue
        ctx.logger.warn(
          `Failed to check for duplicate component name: ${error}. Proceeding with creation.`,
        );
      }

      try {
        // Filter out UI-specific fields from traits (id, schema)
        const cleanedTraits = (ctx.input as any).traits?.map((trait: any) => ({
          name: trait.name,
          instanceName: trait.instanceName,
          config: trait.config,
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
          'traits',
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
          componentTypeWorkloadType:
            (ctx.input as any).component_type_workload_type || 'deployment',
          ctdParameters: ctdParameters,
          useBuiltInCI: ctx.input.useBuiltInCI,
          repoUrl: (ctx.input as any).repo_url,
          branch: (ctx.input as any).branch,
          componentPath: (ctx.input as any).component_path,
          workflowName: (ctx.input as any).workflow_name,
          workflowParameters: (ctx.input as any).workflow_parameters,
          traits: cleanedTraits,
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

        ctx.logger.debug(
          `Invoking /apply resource for component: ${componentResource.metadata.name}`,
        );

        // Call the apply API to create the component
        const {
          data: applyData,
          error: applyError,
          response: applyResponse,
        } = await client.POST('/apply', {
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
          `Component created successfully via /apply: ${JSON.stringify(
            applyData,
          )}`,
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
