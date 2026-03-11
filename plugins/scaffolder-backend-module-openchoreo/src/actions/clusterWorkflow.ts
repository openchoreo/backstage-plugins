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
  translateClusterWorkflowToEntity,
} from '@openchoreo/backstage-plugin-catalog-backend-module';

export const createClusterWorkflowDefinitionAction = (
  config: Config,
  immediateCatalog: ImmediateCatalogService,
) => {
  return createTemplateAction({
    id: 'openchoreo:clusterworkflow-definition:create',
    description: 'Create OpenChoreo ClusterWorkflow',
    schema: {
      input: (zImpl: typeof z) =>
        zImpl.object({
          yamlContent: zImpl
            .string()
            .describe('The YAML content of the ClusterWorkflow definition'),
        }),
      output: (zImpl: typeof z) =>
        zImpl.object({
          clusterWorkflowName: zImpl
            .string()
            .describe('The name of the created ClusterWorkflow'),
          entityRef: zImpl
            .string()
            .describe('Entity reference for the created ClusterWorkflow'),
        }),
    },
    async handler(ctx) {
      ctx.logger.debug(
        `Creating ClusterWorkflow with parameters: ${JSON.stringify(
          ctx.input,
        )}`,
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
      if (resourceObj.kind !== 'ClusterWorkflow') {
        throw new Error(
          `Kind must be ClusterWorkflow, got: ${resourceObj.kind}`,
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
        ctx.logger.debug(
          `Sending ClusterWorkflow creation request: ${JSON.stringify(
            resourceObj,
          )}`,
        );

        const { data, error, response } = await client.POST(
          '/api/v1/clusterworkflows' as any,
          {
            body: resourceObj as any,
          },
        );

        assertApiResponse({ data, error, response }, 'create ClusterWorkflow');

        const resultData = data as Record<string, unknown>;
        const metadata = resultData.metadata as
          | Record<string, unknown>
          | undefined;
        const workflowName = (metadata?.name as string) || '';

        ctx.logger.debug(
          `ClusterWorkflow created successfully: ${JSON.stringify(resultData)}`,
        );

        // Immediately insert the ClusterWorkflow into the catalog
        try {
          ctx.logger.info(
            `Inserting ClusterWorkflow '${workflowName}' into catalog immediately...`,
          );

          // Extract metadata from the parsed YAML
          const yamlMetadata = resourceObj.metadata as
            | Record<string, unknown>
            | undefined;
          const annotations = (yamlMetadata?.annotations || {}) as Record<
            string,
            string
          >;

          const isCI =
            annotations['openchoreo.dev/workflow-scope'] === 'component';

          const entity = translateClusterWorkflowToEntity(
            {
              name: workflowName || (yamlMetadata?.name as string),
              displayName: annotations['openchoreo.dev/display-name'],
              description: annotations['openchoreo.dev/description'],
              createdAt: new Date().toISOString(),
              parameters:
                annotations['openchoreo.dev/component-workflow-parameters'],
              type: isCI ? 'CI' : 'Generic',
            },
            {
              locationKey: 'OpenChoreoEntityProvider',
            },
          );

          await immediateCatalog.insertEntity(entity);

          ctx.logger.info(
            `ClusterWorkflow '${workflowName}' successfully added to catalog`,
          );
        } catch (catalogError) {
          ctx.logger.error(
            `Failed to immediately add ClusterWorkflow to catalog: ${catalogError}. ` +
              `ClusterWorkflow will be visible after the next scheduled catalog sync.`,
          );
        }

        // Set outputs for the scaffolder
        ctx.output('clusterWorkflowName', workflowName);
        ctx.output(
          'entityRef',
          `clusterworkflow:openchoreo-cluster/${workflowName}`,
        );
      } catch (err) {
        ctx.logger.error(`Error creating ClusterWorkflow: ${err}`);
        throw err instanceof Error
          ? err
          : new Error(`Failed to create ClusterWorkflow: ${err}`);
      }
    },
  });
};
