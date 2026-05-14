import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import {
  createOpenChoreoApiClient,
  assertApiResponse,
} from '@openchoreo/openchoreo-client-node';
import { Config } from '@backstage/config';
import { z } from 'zod';
import YAML from 'yaml';
import {
  type ImmediateCatalogService,
  translateResourceTypeToEntity,
} from '@openchoreo/backstage-plugin-catalog-backend-module';

export const createResourceTypeDefinitionAction = (
  config: Config,
  immediateCatalog: ImmediateCatalogService,
) => {
  return createTemplateAction({
    id: 'openchoreo:resourcetype-definition:create',
    description: 'Create OpenChoreo ResourceType',
    schema: {
      input: (zImpl: typeof z) =>
        zImpl.object({
          namespaceName: zImpl
            .string()
            .describe(
              'The name of the namespace to create the ResourceType in',
            ),
          yamlContent: zImpl
            .string()
            .describe('The YAML content of the ResourceType definition'),
        }),
      output: (zImpl: typeof z) =>
        zImpl.object({
          resourceTypeName: zImpl
            .string()
            .describe('The name of the created ResourceType'),
          namespaceName: zImpl
            .string()
            .describe('The namespace where the ResourceType was created'),
          entityRef: zImpl
            .string()
            .describe('Entity reference for the created ResourceType'),
        }),
    },
    async handler(ctx) {
      ctx.logger.debug(
        `Creating ResourceType with parameters: ${JSON.stringify(ctx.input)}`,
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
      if (resourceObj.kind !== 'ResourceType') {
        throw new Error(
          `Kind must be ResourceType, got: ${resourceObj.kind}`,
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
        // Strip Kubernetes-level fields not expected by the API schema
        const {
          apiVersion: _apiVersion,
          kind: _kind,
          ...apiBody
        } = resourceObj;

        ctx.logger.info(
          `Sending ResourceType creation request to namespace '${namespaceName}': ${JSON.stringify(
            apiBody,
          )}`,
        );

        const { data, error, response } = await client.POST(
          '/api/v1/namespaces/{namespaceName}/resourcetypes',
          {
            params: {
              path: { namespaceName },
            },
            body: apiBody as any,
          },
        );

        assertApiResponse({ data, error, response }, 'create ResourceType');

        const resultData = data as Record<string, unknown>;
        const metadata = resultData.metadata as
          | Record<string, unknown>
          | undefined;
        const resultName = (metadata?.name as string) || '';

        ctx.logger.debug(
          `ResourceType created successfully: ${JSON.stringify(resultData)}`,
        );

        // Immediately insert the ResourceType into the catalog
        try {
          ctx.logger.info(
            `Inserting ResourceType '${resultName}' into catalog immediately...`,
          );

          // Extract metadata from the parsed YAML
          const yamlMetadata = resourceObj.metadata as
            | Record<string, unknown>
            | undefined;
          const annotations = (yamlMetadata?.annotations || {}) as Record<
            string,
            string
          >;
          const spec = (resourceObj.spec || {}) as Record<string, unknown>;

          const entity = translateResourceTypeToEntity(
            {
              name: resultName || (yamlMetadata?.name as string),
              displayName: annotations['openchoreo.dev/display-name'],
              description: annotations['openchoreo.dev/description'],
              retainPolicy: spec.retainPolicy as string | undefined,
              createdAt: new Date().toISOString(),
            },
            namespaceName,
            {
              locationKey: 'OpenChoreoEntityProvider',
            },
          );

          await immediateCatalog.insertEntity(entity);

          ctx.logger.info(
            `ResourceType '${resultName}' successfully added to catalog`,
          );
        } catch (catalogError) {
          ctx.logger.error(
            `Failed to immediately add ResourceType to catalog: ${catalogError}. ` +
              `ResourceType will be visible after the next scheduled catalog sync.`,
          );
        }

        // Set outputs for the scaffolder
        ctx.output('resourceTypeName', resultName);
        ctx.output('namespaceName', namespaceName);
        ctx.output('entityRef', `resourcetype:${namespaceName}/${resultName}`);
      } catch (err) {
        ctx.logger.error(`Error creating ResourceType: ${err}`);
        throw err instanceof Error
          ? err
          : new Error(`Failed to create ResourceType: ${err}`);
      }
    },
  });
};
