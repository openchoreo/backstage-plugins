import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import {
  createOpenChoreoApiClient,
  assertApiResponse,
} from '@openchoreo/openchoreo-client-node';
import { Config } from '@backstage/config';
import { z } from 'zod';
import {
  type ImmediateCatalogService,
  translateDeploymentPipelineToEntity,
} from '@openchoreo/backstage-plugin-catalog-backend-module';

export const createDeploymentPipelineAction = (
  config: Config,
  immediateCatalog: ImmediateCatalogService,
) => {
  return createTemplateAction({
    id: 'openchoreo:deployment-pipeline:create',
    description: 'Create OpenChoreo Deployment Pipeline',
    schema: {
      input: (zImpl: typeof z) =>
        zImpl.object({
          namespaceName: zImpl
            .string()
            .describe(
              'The name of the namespace to create the deployment pipeline in',
            ),
          pipelineName: zImpl
            .string()
            .describe('The name of the deployment pipeline to create'),
          displayName: zImpl
            .string()
            .optional()
            .describe('The display name of the deployment pipeline'),
          description: zImpl
            .string()
            .optional()
            .describe('The description of the deployment pipeline'),
          promotionPaths: zImpl
            .array(
              zImpl.object({
                sourceEnvironmentRef: zImpl.object({
                  kind: zImpl.string().optional(),
                  name: zImpl.string(),
                }),
                targetEnvironmentRefs: zImpl.array(
                  zImpl.object({
                    kind: zImpl.string().optional(),
                    name: zImpl.string(),
                  }),
                ),
              }),
            )
            .optional()
            .describe('Promotion paths between environments'),
        }),
      output: (zImpl: typeof z) =>
        zImpl.object({
          pipelineName: zImpl
            .string()
            .describe('The name of the created deployment pipeline'),
          namespaceName: zImpl
            .string()
            .describe(
              'The namespace where the deployment pipeline was created',
            ),
          entityRef: zImpl
            .string()
            .describe('Entity reference for the created deployment pipeline'),
        }),
    },
    async handler(ctx) {
      ctx.logger.debug(
        `Creating deployment pipeline with parameters: ${JSON.stringify(
          ctx.input,
        )}`,
      );

      // Extract entity name from entity reference format (e.g., "domain:default/default-ns" -> "default-ns")
      const extractEntityName = (entityRef: string): string => {
        const parts = entityRef.split('/');
        return parts[parts.length - 1];
      };

      const namespaceName = extractEntityName(ctx.input.namespaceName);
      ctx.logger.debug(
        `Extracted namespace name: ${namespaceName} from ${ctx.input.namespaceName}`,
      );

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

      const client = createOpenChoreoApiClient({
        baseUrl,
        token,
        logger: ctx.logger,
      });

      try {
        const { data, error, response } = await client.POST(
          '/api/v1/namespaces/{namespaceName}/deploymentpipelines',
          {
            params: {
              path: { namespaceName },
            },
            body: {
              metadata: {
                name: ctx.input.pipelineName,
                annotations: {
                  ...(ctx.input.displayName
                    ? {
                        'openchoreo.dev/display-name': ctx.input.displayName,
                      }
                    : {}),
                  ...(ctx.input.description
                    ? {
                        'openchoreo.dev/description': ctx.input.description,
                      }
                    : {}),
                },
              },
              spec: {
                promotionPaths: ctx.input.promotionPaths?.map(p => ({
                  sourceEnvironmentRef: {
                    kind: 'Environment' as const,
                    name: p.sourceEnvironmentRef.name,
                  },
                  targetEnvironmentRefs: p.targetEnvironmentRefs.map(t => ({
                    kind: 'Environment' as const,
                    name: t.name,
                  })),
                })),
              },
            },
          },
        );

        assertApiResponse(
          { data, error, response },
          'create deployment pipeline',
        );

        ctx.logger.debug(
          `Deployment pipeline created successfully: ${JSON.stringify(data)}`,
        );

        const pipelineName = data?.metadata?.name || ctx.input.pipelineName;

        // Immediately insert the deployment pipeline into the catalog
        try {
          ctx.logger.info(
            `Inserting deployment pipeline '${pipelineName}' into catalog immediately...`,
          );

          const promotionPaths = (
            data?.spec?.promotionPaths ||
            ctx.input.promotionPaths ||
            []
          ).map(p => ({
            sourceEnvironment:
              typeof p.sourceEnvironmentRef === 'string'
                ? p.sourceEnvironmentRef
                : (p.sourceEnvironmentRef as { name: string })?.name ?? '',
            targetEnvironments: (p.targetEnvironmentRefs || []).map(t => ({
              name: t.name,
            })),
          }));

          const entity = translateDeploymentPipelineToEntity(
            {
              name: pipelineName,
              displayName: ctx.input.displayName,
              description: ctx.input.description,
              uid: data?.metadata?.uid,
              promotionPaths,
              projectRefs: [],
              createdAt:
                data?.metadata?.creationTimestamp || new Date().toISOString(),
            },
            namespaceName,
            {
              locationKey: 'provider:OpenChoreoEntityProvider',
            },
          );

          await immediateCatalog.insertEntity(entity);

          ctx.logger.info(
            `Deployment pipeline '${pipelineName}' successfully added to catalog`,
          );
        } catch (catalogError) {
          ctx.logger.error(
            `Failed to immediately add deployment pipeline to catalog: ${catalogError}. ` +
              `Deployment pipeline will be visible after the next scheduled catalog sync.`,
          );
        }

        ctx.output('pipelineName', pipelineName);
        ctx.output('namespaceName', namespaceName);
        ctx.output(
          'entityRef',
          `deploymentpipeline:${namespaceName}/${pipelineName}`,
        );
      } catch (err) {
        ctx.logger.error(`Error creating deployment pipeline: ${err}`);
        throw err instanceof Error
          ? err
          : new Error(`Failed to create deployment pipeline: ${String(err)}`);
      }
    },
  });
};
