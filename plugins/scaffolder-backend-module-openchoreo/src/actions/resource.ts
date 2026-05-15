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
  translateResourceToEntity,
} from '@openchoreo/backstage-plugin-catalog-backend-module';

/**
 * Scaffolder action that creates an OpenChoreo Resource via the
 * openchoreo-api and immediately inserts the corresponding entity into
 * the Backstage catalog. The Resource YAML body is sent verbatim after
 * stripping the Kubernetes-only `apiVersion`/`kind` envelope, mirroring
 * the ResourceType / ComponentType actions.
 */
export const createResourceAction = (
  config: Config,
  immediateCatalog: ImmediateCatalogService,
) => {
  return createTemplateAction({
    id: 'openchoreo:resource:create',
    description: 'Create OpenChoreo Resource',
    schema: {
      input: (zImpl: typeof z) =>
        zImpl.object({
          namespaceName: zImpl
            .string()
            .describe('The name of the namespace to create the Resource in'),
          yamlContent: zImpl
            .string()
            .describe('The YAML content of the Resource definition'),
        }),
      output: (zImpl: typeof z) =>
        zImpl.object({
          resourceName: zImpl
            .string()
            .describe('The name of the created Resource'),
          namespaceName: zImpl
            .string()
            .describe('The namespace where the Resource was created'),
          projectName: zImpl
            .string()
            .describe('The project that owns the created Resource'),
          entityRef: zImpl
            .string()
            .describe('Entity reference for the created Resource'),
        }),
    },
    async handler(ctx) {
      ctx.logger.debug(
        `Creating Resource with parameters: ${JSON.stringify(ctx.input)}`,
      );

      // Inputs may arrive as `domain:default/<ns>` from a NamespaceEntityPicker
      // — strip down to the bare name.
      const extractNamespaceName = (fullNamespaceName: string): string => {
        const parts = fullNamespaceName.split('/');
        return parts[parts.length - 1];
      };

      const namespaceName = extractNamespaceName(ctx.input.namespaceName);
      ctx.logger.debug(
        `Extracted namespace name: ${namespaceName} from ${ctx.input.namespaceName}`,
      );

      let resourceObj: Record<string, unknown>;
      try {
        resourceObj = YAML.parse(ctx.input.yamlContent);
      } catch (parseError) {
        throw new Error(`Invalid YAML content: ${parseError}`);
      }

      if (!resourceObj || typeof resourceObj !== 'object') {
        throw new Error('YAML content must be a valid object');
      }

      if (resourceObj.kind !== 'Resource') {
        throw new Error(`Kind must be Resource, got: ${resourceObj.kind}`);
      }

      if (!resourceObj.apiVersion) {
        throw new Error('apiVersion is required in the YAML content');
      }

      const baseUrl = config.getString('openchoreo.baseUrl');
      const authzEnabled =
        config.getOptionalBoolean('openchoreo.features.auth.enabled') ?? true;
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
        const {
          apiVersion: _apiVersion,
          kind: _kind,
          ...apiBody
        } = resourceObj;

        ctx.logger.info(
          `Sending Resource creation request to namespace '${namespaceName}': ${JSON.stringify(
            apiBody,
          )}`,
        );

        const { data, error, response } = await client.POST(
          '/api/v1/namespaces/{namespaceName}/resources',
          {
            params: {
              path: { namespaceName },
            },
            body: apiBody as any,
          },
        );

        assertApiResponse({ data, error, response }, 'create Resource');

        const resultData = data as Record<string, unknown>;
        const metadata = resultData.metadata as
          | Record<string, unknown>
          | undefined;
        const resultName = (metadata?.name as string) || '';
        const spec = (resultData.spec || resourceObj.spec || {}) as Record<
          string,
          unknown
        >;
        const owner = (spec.owner as Record<string, unknown> | undefined) ?? {};
        const typeRef =
          (spec.type as Record<string, unknown> | undefined) ?? {};
        const projectName = (owner.projectName as string) || '';
        const typeName = (typeRef.name as string) || '';
        const typeKindRaw = typeRef.kind as string | undefined;
        if (
          typeKindRaw !== 'ResourceType' &&
          typeKindRaw !== 'ClusterResourceType'
        ) {
          throw new Error(
            `spec.type.kind must be either "ResourceType" or "ClusterResourceType", got: ${typeKindRaw}`,
          );
        }
        const typeKind = typeKindRaw as 'ResourceType' | 'ClusterResourceType';

        ctx.logger.debug(
          `Resource created successfully: ${JSON.stringify(resultData)}`,
        );

        try {
          ctx.logger.info(
            `Inserting Resource '${resultName}' into catalog immediately...`,
          );

          const defaultOwner =
            config.getOptionalString('openchoreo.defaultOwner') ||
            'openchoreo-users';

          const yamlMetadata = resourceObj.metadata as
            | Record<string, unknown>
            | undefined;
          const annotations = (yamlMetadata?.annotations || {}) as Record<
            string,
            string
          >;

          const parameters = spec.parameters as
            | Record<string, unknown>
            | undefined;

          const entity = translateResourceToEntity(
            {
              name: resultName || (yamlMetadata?.name as string),
              uid: metadata?.uid as string | undefined,
              displayName: annotations['openchoreo.dev/display-name'],
              description: annotations['openchoreo.dev/description'],
              projectName,
              typeName,
              typeKind,
              parameters,
              createdAt: new Date().toISOString(),
            },
            namespaceName,
            {
              locationKey: 'OpenChoreoEntityProvider',
              defaultOwner: `group:default/${defaultOwner}`,
            },
          );

          await immediateCatalog.insertEntity(entity);

          ctx.logger.info(
            `Resource '${resultName}' successfully added to catalog`,
          );
        } catch (catalogError) {
          ctx.logger.error(
            `Failed to immediately add Resource to catalog: ${catalogError}. ` +
              `Resource will be visible after the next scheduled catalog sync.`,
          );
        }

        ctx.output('resourceName', resultName);
        ctx.output('namespaceName', namespaceName);
        ctx.output('projectName', projectName);
        ctx.output('entityRef', `resource:${namespaceName}/${resultName}`);
      } catch (err) {
        ctx.logger.error(`Error creating Resource: ${err}`);
        throw err instanceof Error
          ? err
          : new Error(`Failed to create Resource: ${err}`);
      }
    },
  });
};
