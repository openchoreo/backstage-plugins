import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import {
  createOpenChoreoApiClient,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';
import { Config } from '@backstage/config';
import { z } from 'zod';
import { buildComponentResource } from './componentResourceBuilder';
import { CatalogClient } from '@backstage/catalog-client';
import {
  CHOREO_ANNOTATIONS,
  ComponentTypeUtils,
} from '@openchoreo/backstage-plugin-common';
import {
  type ImmediateCatalogService,
  translateComponentToEntity,
} from '@openchoreo/backstage-plugin-catalog-backend-module';
import type { DiscoveryService } from '@backstage/backend-plugin-api';

type ModelsComponent = OpenChoreoComponents['schemas']['ComponentResponse'];

// Kubernetes DNS subdomain name validation
const K8S_NAME_PATTERN =
  /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;
const MAX_NAME_LENGTH = 253;

export const createComponentAction = (
  config: Config,
  discovery: DiscoveryService,
  immediateCatalog: ImmediateCatalogService,
) => {
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

            // Optional fields
            useBuiltInCI: zImpl.boolean().optional(),
            autoDeploy: zImpl.boolean().optional(),
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
        const catalogApi = new CatalogClient({
          discoveryApi: discovery,
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

        // Extract CI/CD setup data
        const useBuiltInCI = ctx.input.useBuiltInCI ?? false;
        const autoDeploy = ctx.input.autoDeploy ?? false;
        const workflowName = (ctx.input as any).workflow_name;
        const workflowParametersData = (ctx.input as any).workflow_parameters;
        // Extract parameters from the new structure (workflow_parameters.parameters)
        const workflowParameters =
          workflowParametersData?.parameters || workflowParametersData;

        // Extract CTD-specific parameters by filtering out known scaffolder fields
        const knownScaffolderFields = new Set([
          'orgName',
          'projectName',
          'componentName',
          'displayName',
          'description',
          'componentType',
          'useBuiltInCI',
          'autoDeploy',
          'workflow_name',
          'workflow_parameters',
          'traits',
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
          useBuiltInCI: useBuiltInCI,
          autoDeploy: autoDeploy,
          repoUrl: (ctx.input as any).repo_url,
          branch: (ctx.input as any).branch,
          componentPath: (ctx.input as any).component_path,
          workflowName: workflowName,
          workflowParameters: workflowParameters,
          traits: cleanedTraits,
        });

        // Create the API client using the auto-generated client
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

        // Immediately insert the component into the catalog
        try {
          ctx.logger.info(
            `Inserting component '${ctx.input.componentName}' into catalog immediately...`,
          );

          // Build the full component type in OpenChoreo format: {workloadType}/{componentType}
          const workloadType =
            (ctx.input as any).component_type_workload_type || 'deployment';
          const fullComponentType = `${workloadType}/${ctx.input.componentType}`;

          ctx.logger.debug(
            `Component type for catalog: ${fullComponentType} (workloadType: ${workloadType}, componentType: ${ctx.input.componentType})`,
          );

          // Build ModelsComponent object matching OpenChoreo API response structure
          const component: ModelsComponent = {
            uid: `temp-${ctx.input.componentName}`, // Temporary UID
            name: ctx.input.componentName,
            displayName: ctx.input.displayName,
            description: ctx.input.description,
            type: fullComponentType, // Use full type format: deployment/service
            projectName: projectName,
            orgName: orgName,
            status: 'Active', // New components are active by default
            createdAt: new Date().toISOString(),
            autoDeploy: autoDeploy,
            // Repository info is stored in workflow.schema.repository
            componentWorkflow: (ctx.input as any).repo_url
              ? {
                  name: (ctx.input as any).workflow_name || 'default',
                  systemParameters: {
                    repository: {
                      url: (ctx.input as any).repo_url,
                      revision: {
                        branch: (ctx.input as any).branch,
                      },
                      appPath: (ctx.input as any).component_path,
                    },
                  },
                  parameters: workflowParameters,
                }
              : undefined,
          };

          // Get configuration values
          const defaultOwner =
            config.getOptionalString('openchoreo.defaultOwner') || 'developers';
          const componentTypeUtils = ComponentTypeUtils.fromConfig(config);

          // Use the shared translation utility for consistency with scheduled sync
          const entity = translateComponentToEntity(
            component,
            orgName,
            projectName,
            {
              defaultOwner,
              componentTypeUtils,
              locationKey: 'provider:OpenChoreoEntityProvider',
            },
          );

          ctx.logger.debug(
            `Entity to insert: ${JSON.stringify(entity, null, 2)}`,
          );

          // Insert into catalog immediately
          await immediateCatalog.insertEntity(entity);

          ctx.logger.info(
            `Component '${ctx.input.componentName}' successfully added to catalog`,
          );
        } catch (catalogError) {
          // Log error but don't fail the scaffolder action
          // The component was created successfully, catalog sync will pick it up eventually
          ctx.logger.error(
            `Failed to immediately add component to catalog: ${catalogError}. ` +
              `Component will be visible after the next scheduled catalog sync.`,
          );
        }

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
