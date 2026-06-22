import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import {
  createOpenChoreoApiClient,
  assertApiResponse,
} from '@openchoreo/openchoreo-client-node';
import { Config } from '@backstage/config';
import YAML from 'yaml';
import {
  type ImmediateCatalogService,
  translateProjectTypeToEntity,
} from '@openchoreo/backstage-plugin-catalog-backend-module';

export const createProjectTypeDefinitionAction = (
  config: Config,
  immediateCatalog: ImmediateCatalogService,
) => {
  return createTemplateAction({
    id: 'openchoreo:projecttype-definition:create',
    description: 'Create OpenChoreo ProjectType',
    schema: {
      input: {
        namespaceName: z =>
          z.string({
            description:
              'The name of the namespace to create the ProjectType in',
          }),
        yamlContent: z =>
          z.string({
            description: 'The YAML content of the ProjectType definition',
          }),
      },
      output: {
        projectTypeName: z =>
          z.string({ description: 'The name of the created ProjectType' }),
        namespaceName: z =>
          z.string({
            description: 'The namespace where the ProjectType was created',
          }),
        entityRef: z =>
          z.string({
            description: 'Entity reference for the created ProjectType',
          }),
      },
    },
    async handler(ctx) {
      ctx.logger.debug(
        `Creating ProjectType (namespace input: '${ctx.input.namespaceName}')`,
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
      if (resourceObj.kind !== 'ProjectType') {
        throw new Error(`Kind must be ProjectType, got: ${resourceObj.kind}`);
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
          'User authentication token not available. Ensure you are logged in.',
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
          `Sending ProjectType creation request to namespace '${namespaceName}'`,
        );

        const { data, error, response } = await client.POST(
          '/api/v1/namespaces/{namespaceName}/projecttypes',
          {
            params: {
              path: { namespaceName },
            },
            body: apiBody as any,
          },
        );

        assertApiResponse({ data, error, response }, 'create ProjectType');

        const resultData = data as Record<string, unknown>;
        const metadata = resultData.metadata as
          | Record<string, unknown>
          | undefined;
        const resultName = (metadata?.name as string) || '';

        ctx.logger.debug(
          `ProjectType created successfully: ${JSON.stringify(resultData)}`,
        );

        // Immediately insert the ProjectType into the catalog
        try {
          ctx.logger.info(
            `Inserting ProjectType '${resultName}' into catalog immediately...`,
          );

          // Extract metadata from the parsed YAML
          const yamlMetadata = resourceObj.metadata as
            | Record<string, unknown>
            | undefined;
          const annotations = (yamlMetadata?.annotations || {}) as Record<
            string,
            string
          >;

          const entity = translateProjectTypeToEntity(
            {
              name: resultName || (yamlMetadata?.name as string),
              displayName: annotations['openchoreo.dev/display-name'],
              description: annotations['openchoreo.dev/description'],
              createdAt: new Date().toISOString(),
            },
            namespaceName,
            {
              locationKey: 'OpenChoreoEntityProvider',
            },
          );

          await immediateCatalog.insertEntity(entity);

          ctx.logger.info(
            `ProjectType '${resultName}' successfully added to catalog`,
          );
        } catch (catalogError) {
          ctx.logger.error(
            `Failed to immediately add ProjectType to catalog: ${catalogError}. ` +
              `ProjectType will be visible after the next scheduled catalog sync.`,
          );
        }

        // Set outputs for the scaffolder
        ctx.output('projectTypeName', resultName);
        ctx.output('namespaceName', namespaceName);
        ctx.output('entityRef', `projecttype:${namespaceName}/${resultName}`);
      } catch (err) {
        ctx.logger.error(`Error creating ProjectType: ${err}`);
        throw err instanceof Error
          ? err
          : new Error(`Failed to create ProjectType: ${err}`);
      }
    },
  });
};
