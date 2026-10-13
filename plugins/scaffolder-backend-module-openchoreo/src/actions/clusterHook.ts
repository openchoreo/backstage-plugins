import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import {
  createOpenChoreoApiClient,
  assertApiResponse,
} from '@openchoreo/openchoreo-client-node';
import { Config } from '@backstage/config';
import YAML from 'yaml';
import {
  type HookSpecInput,
  type ImmediateCatalogService,
  translateClusterHookToEntity,
} from '@openchoreo/backstage-plugin-catalog-backend-module';

/**
 * Creates a ClusterHook (deployment hooks, alpha) from a YAML definition.
 * Spec validation is done by the OpenChoreo admission webhook; its message
 * is surfaced verbatim.
 */
export const createClusterHookDefinitionAction = (
  config: Config,
  immediateCatalog: ImmediateCatalogService,
) => {
  return createTemplateAction({
    id: 'openchoreo:clusterhook-definition:create',
    description: 'Create OpenChoreo ClusterHook (deployment hooks, alpha)',
    schema: {
      input: {
        yamlContent: z =>
          z.string({
            description: 'The YAML content of the ClusterHook definition',
          }),
      },
      output: {
        clusterHookName: z =>
          z.string({ description: 'The name of the created ClusterHook' }),
        entityRef: z =>
          z.string({
            description: 'Entity reference for the created ClusterHook',
          }),
      },
    },
    async handler(ctx) {
      let resourceObj: Record<string, unknown>;
      try {
        resourceObj = YAML.parse(ctx.input.yamlContent);
      } catch (parseError) {
        throw new Error(`Invalid YAML content: ${parseError}`);
      }
      if (!resourceObj || typeof resourceObj !== 'object') {
        throw new Error('YAML content must be a valid object');
      }
      if (resourceObj.kind !== 'ClusterHook') {
        throw new Error(`Kind must be ClusterHook, got: ${resourceObj.kind}`);
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
          'User authentication token not available. Ensure you are logged in.',
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

        const { data, error, response } = await client.POST(
          '/api/v1/clusterhooks',
          { body: apiBody as any },
        );
        assertApiResponse({ data, error, response }, 'create ClusterHook');

        const resultData = data as Record<string, unknown>;
        const metadata = resultData.metadata as
          | Record<string, unknown>
          | undefined;
        const yamlMetadata = resourceObj.metadata as
          | Record<string, unknown>
          | undefined;
        const resultName =
          (metadata?.name as string) || (yamlMetadata?.name as string) || '';
        const annotations = (yamlMetadata?.annotations || {}) as Record<
          string,
          string
        >;

        try {
          const entity = translateClusterHookToEntity(
            {
              name: resultName,
              displayName: annotations['openchoreo.dev/display-name'],
              description: annotations['openchoreo.dev/description'],
              createdAt: new Date().toISOString(),
              spec: (resultData.spec ??
                resourceObj.spec ??
                {}) as unknown as HookSpecInput,
            },
            { locationKey: 'OpenChoreoEntityProvider' },
          );
          await immediateCatalog.insertEntity(entity);
          ctx.logger.info(`ClusterHook '${resultName}' added to catalog`);
        } catch (catalogError) {
          ctx.logger.error(
            `Failed to immediately add ClusterHook to catalog: ${catalogError}. ` +
              `It will be visible after the next scheduled catalog sync.`,
          );
        }

        ctx.output('clusterHookName', resultName);
        ctx.output('entityRef', `clusterhook:openchoreo-cluster/${resultName}`);
      } catch (err) {
        ctx.logger.error(`Error creating ClusterHook: ${err}`);
        throw new Error(`Failed to create ClusterHook: ${err}`);
      }
    },
  });
};
