import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { createOpenChoreoApiClient } from '@openchoreo/openchoreo-client-node';
import { Config } from '@backstage/config';
import { z } from 'zod';
import YAML from 'yaml';
import {
  type ImmediateCatalogService,
  translateComponentTypeToEntity,
} from '@openchoreo/backstage-plugin-catalog-backend-module';

export const createComponentTypeDefinitionAction = (
  config: Config,
  immediateCatalog: ImmediateCatalogService,
) => {
  return createTemplateAction({
    id: 'openchoreo:componenttype-definition:create',
    description: 'Create OpenChoreo ComponentType',
    schema: {
      input: (zImpl: typeof z) =>
        zImpl.object({
          namespaceName: zImpl
            .string()
            .describe(
              'The name of the namespace to create the ComponentType in',
            ),
          yamlContent: zImpl
            .string()
            .describe('The YAML content of the ComponentType definition'),
        }),
      output: (zImpl: typeof z) =>
        zImpl.object({
          componentTypeName: zImpl
            .string()
            .describe('The name of the created ComponentType'),
          namespaceName: zImpl
            .string()
            .describe(
              'The namespace where the ComponentType was created',
            ),
          entityRef: zImpl
            .string()
            .describe('Entity reference for the created ComponentType'),
        }),
    },
    async handler(ctx) {
      ctx.logger.debug(
        `Creating ComponentType with parameters: ${JSON.stringify(ctx.input)}`,
      );

      // Extract namespace name from domain format (e.g., "domain:default/my-namespace" -> "my-namespace")
      const extractNamespaceName = (fullNamespaceName: string): string => {
        const parts = fullNamespaceName.split('/');
        return parts[parts.length - 1];
      };

      const namespaceName = extractNamespaceName(ctx.input.namespaceName);
      ctx.logger.debug(
        `Extracted namespace name: ${namespaceName} from ${ctx.input.namespaceName}`,
      );

      // Parse and validate YAML content
      let resourceObj: Record<string, unknown>;
      try {
        resourceObj = YAML.parse(ctx.input.yamlContent);
      } catch (parseError) {
        throw new Error(`Invalid YAML content: ${parseError}`);
      }

      if (!resourceObj || typeof resourceObj !== 'object') {
        throw new Error('YAML content must be a valid object');
      }

      // Validate required fields
      if (resourceObj.kind !== 'ComponentType') {
        throw new Error(
          `Kind must be ComponentType, got: ${resourceObj.kind}`,
        );
      }

      if (!resourceObj.apiVersion) {
        throw new Error('apiVersion is required in the YAML content');
      }

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
          '/namespaces/{namespaceName}/component-types/definition',
          {
            params: {
              path: { namespaceName },
            },
            body: resourceObj,
          },
        );

        if (error || !response.ok) {
          throw new Error(
            `Failed to create ComponentType: ${response.status} ${response.statusText}`,
          );
        }

        if (!data?.success || !data?.data) {
          throw new Error('API request was not successful');
        }

        const resultData = data.data as Record<string, unknown>;
        const resultName = (resultData.name as string) || '';

        ctx.logger.debug(
          `ComponentType created successfully: ${JSON.stringify(resultData)}`,
        );

        // Immediately insert the ComponentType into the catalog
        try {
          ctx.logger.info(
            `Inserting ComponentType '${resultName}' into catalog immediately...`,
          );

          // Extract metadata from the parsed YAML
          const metadata = resourceObj.metadata as Record<string, unknown> | undefined;
          const annotations = (metadata?.annotations || {}) as Record<string, string>;
          const spec = (resourceObj.spec || {}) as Record<string, unknown>;

          const entity = translateComponentTypeToEntity(
            {
              name: resultName || (metadata?.name as string),
              displayName: annotations['openchoreo.dev/display-name'],
              description: annotations['openchoreo.dev/description'],
              workloadType: spec.workloadType as string,
              allowedWorkflows: spec.allowedWorkflows as string[] | undefined,
              createdAt: new Date().toISOString(),
            },
            namespaceName,
            {
              locationKey: 'OpenChoreoEntityProvider',
            },
          );

          await immediateCatalog.insertEntity(entity);

          ctx.logger.info(
            `ComponentType '${resultName}' successfully added to catalog`,
          );
        } catch (catalogError) {
          ctx.logger.error(
            `Failed to immediately add ComponentType to catalog: ${catalogError}. ` +
              `ComponentType will be visible after the next scheduled catalog sync.`,
          );
        }

        // Set outputs for the scaffolder
        ctx.output('componentTypeName', resultName);
        ctx.output('namespaceName', namespaceName);
        ctx.output(
          'entityRef',
          `componenttype:${namespaceName}/${resultName}`,
        );
      } catch (err) {
        ctx.logger.error(`Error creating ComponentType: ${err}`);
        throw new Error(`Failed to create ComponentType: ${err}`);
      }
    },
  });
};
