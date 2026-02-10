import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { createOpenChoreoApiClient } from '@openchoreo/openchoreo-client-node';
import { Config } from '@backstage/config';
import { z } from 'zod';
import YAML from 'yaml';

export const createComponentWorkflowAction = (config: Config) => {
  return createTemplateAction({
    id: 'openchoreo:componentworkflow:create',
    description: 'Create OpenChoreo ComponentWorkflow',
    schema: {
      input: (zImpl: typeof z) =>
        zImpl.object({
          namespaceName: zImpl
            .string()
            .describe(
              'The name of the namespace to create the ComponentWorkflow in',
            ),
          yamlContent: zImpl
            .string()
            .describe('The YAML content of the ComponentWorkflow definition'),
        }),
      output: (zImpl: typeof z) =>
        zImpl.object({
          componentWorkflowName: zImpl
            .string()
            .describe('The name of the created ComponentWorkflow'),
          namespaceName: zImpl
            .string()
            .describe(
              'The namespace where the ComponentWorkflow was created',
            ),
        }),
    },
    async handler(ctx) {
      ctx.logger.debug(
        `Creating ComponentWorkflow with parameters: ${JSON.stringify(ctx.input)}`,
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
      if (resourceObj.kind !== 'ComponentWorkflow') {
        throw new Error(
          `Kind must be ComponentWorkflow, got: ${resourceObj.kind}`,
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
          '/namespaces/{namespaceName}/component-workflows',
          {
            params: {
              path: { namespaceName },
            },
            body: resourceObj,
          },
        );

        if (error || !response.ok) {
          throw new Error(
            `Failed to create ComponentWorkflow: ${response.status} ${response.statusText}`,
          );
        }

        if (!data?.success || !data?.data) {
          throw new Error('API request was not successful');
        }

        const resultData = data.data as Record<string, unknown>;
        const resultName = (resultData.name as string) || '';

        ctx.logger.debug(
          `ComponentWorkflow created successfully: ${JSON.stringify(resultData)}`,
        );

        // Set outputs for the scaffolder
        ctx.output('componentWorkflowName', resultName);
        ctx.output('namespaceName', namespaceName);
      } catch (err) {
        ctx.logger.error(`Error creating ComponentWorkflow: ${err}`);
        throw new Error(`Failed to create ComponentWorkflow: ${err}`);
      }
    },
  });
};
