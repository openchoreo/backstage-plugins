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
  translateHookToEntity,
} from '@openchoreo/backstage-plugin-catalog-backend-module';

function extractEntityName(ref: string): string {
  const parts = ref.split('/');
  return parts[parts.length - 1];
}

/**
 * Creates a namespaced deployment Hook (alpha) from a YAML definition.
 * Validation of the spec (parameter sources, workflow ref, enabledTo) is
 * done by the OpenChoreo admission webhook; its message is surfaced verbatim.
 */
export const createHookDefinitionAction = (
  config: Config,
  immediateCatalog: ImmediateCatalogService,
) => {
  return createTemplateAction({
    id: 'openchoreo:hook-definition:create',
    description: 'Create OpenChoreo Hook (deployment hooks, alpha)',
    schema: {
      input: {
        namespaceName: z =>
          z.string({
            description:
              'The namespace (name or entity ref) to create the Hook in',
          }),
        yamlContent: z =>
          z.string({ description: 'The YAML content of the Hook definition' }),
      },
      output: {
        hookName: z =>
          z.string({ description: 'The name of the created Hook' }),
        namespaceName: z =>
          z.string({ description: 'The namespace where the Hook was created' }),
        entityRef: z =>
          z.string({ description: 'Entity reference for the created Hook' }),
      },
    },
    async handler(ctx) {
      const namespaceName = extractEntityName(ctx.input.namespaceName);
      ctx.logger.debug(`Creating Hook in namespace ${namespaceName}`);

      let resourceObj: Record<string, unknown>;
      try {
        resourceObj = YAML.parse(ctx.input.yamlContent);
      } catch (parseError) {
        throw new Error(`Invalid YAML content: ${parseError}`);
      }
      if (!resourceObj || typeof resourceObj !== 'object') {
        throw new Error('YAML content must be a valid object');
      }
      if (resourceObj.kind !== 'Hook') {
        throw new Error(`Kind must be Hook, got: ${resourceObj.kind}`);
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
        const { data, error, response } = await client.POST(
          '/api/v1/namespaces/{namespaceName}/hooks',
          {
            params: { path: { namespaceName } },
            body: resourceObj as any,
          },
        );
        assertApiResponse({ data, error, response }, 'create Hook');

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
          const entity = translateHookToEntity(
            {
              name: resultName,
              displayName: annotations['openchoreo.dev/display-name'],
              description: annotations['openchoreo.dev/description'],
              createdAt: new Date().toISOString(),
              spec: (resultData.spec ??
                resourceObj.spec ??
                {}) as unknown as HookSpecInput,
            },
            namespaceName,
            { locationKey: 'OpenChoreoEntityProvider' },
          );
          await immediateCatalog.insertEntity(entity);
          ctx.logger.info(`Hook '${resultName}' added to catalog`);
        } catch (catalogError) {
          ctx.logger.error(
            `Failed to immediately add Hook to catalog: ${catalogError}. ` +
              `It will be visible after the next scheduled catalog sync.`,
          );
        }

        ctx.output('hookName', resultName);
        ctx.output('namespaceName', namespaceName);
        ctx.output('entityRef', `hook:${namespaceName}/${resultName}`);
      } catch (err) {
        ctx.logger.error(`Error creating Hook: ${err}`);
        throw new Error(`Failed to create Hook: ${err}`);
      }
    },
  });
};
