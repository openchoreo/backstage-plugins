import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import {
  createOpenChoreoApiClient,
  assertApiResponse,
} from '@openchoreo/openchoreo-client-node';
import { Config } from '@backstage/config';
import {
  type ImmediateCatalogService,
  translateProjectToEntity,
} from '@openchoreo/backstage-plugin-catalog-backend-module';

type OpenChoreoClient = ReturnType<typeof createOpenChoreoApiClient>;

type ActionLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
};

const environmentRefName = (
  ref: { name?: string } | string | undefined,
): string | undefined => (typeof ref === 'string' ? ref : ref?.name);

/**
 * Expands the environment names a DeploymentPipeline promotes through:
 * source + target refs of every promotion path, deduplicated, in pipeline
 * order. Mirrors the expansion the Deploy tab performs in
 * EnvironmentInfoService.
 */
const expandPipelineEnvironments = (pipeline: {
  spec?: {
    promotionPaths?: Array<{
      sourceEnvironmentRef?: { name?: string } | string;
      targetEnvironmentRefs?: Array<{ name?: string } | string>;
    }>;
  };
}): string[] => {
  const environments: string[] = [];
  const seen = new Set<string>();
  const add = (name: string | undefined) => {
    if (name && !seen.has(name)) {
      seen.add(name);
      environments.push(name);
    }
  };
  for (const path of pipeline.spec?.promotionPaths ?? []) {
    add(environmentRefName(path.sourceEnvironmentRef));
    for (const target of path.targetEnvironmentRefs ?? []) {
      add(environmentRefName(target));
    }
  }
  return environments;
};

/**
 * Creates one unpinned ProjectReleaseBinding per environment of the
 * project's DeploymentPipeline (name `{project}-{env}`, spec.owner +
 * spec.environment only). `spec.projectRelease` is deliberately left unset:
 * the first ProjectRelease does not exist yet at project-creation time; the
 * control plane seeds empty pins with the latest release once it is cut.
 *
 * Bindings are created concurrently (Promise.allSettled) to keep the
 * scaffolder step fast, then aggregated into created/failed sets in pipeline
 * order.
 *
 * Failure semantics: binding creation is best-effort and never fails the
 * scaffolder task, because the project is already created at this point and
 * the user must still be able to navigate to it (via the template's "View
 * Project" link). A pipeline fetch failure only warns; per-environment
 * failures are logged and the other environments still proceed; 409 means the
 * binding already exists (safe re-run) and counts as success. Even when every
 * create fails the step succeeds with an empty result and a warning; the user
 * can deploy per environment from the Deploy tab.
 */
const createInitialReleaseBindings = async (options: {
  client: OpenChoreoClient;
  logger: ActionLogger;
  namespaceName: string;
  projectName: string;
  pipelineName: string;
}): Promise<{ created: string[]; failed: string[] }> => {
  const { client, logger, namespaceName, projectName, pipelineName } = options;

  let environments: string[];
  try {
    const { data, error, response } = await client.GET(
      '/api/v1/namespaces/{namespaceName}/deploymentpipelines/{deploymentPipelineName}',
      {
        params: {
          path: { namespaceName, deploymentPipelineName: pipelineName },
        },
      },
    );
    if (error || !response.ok || !data) {
      logger.warn(
        `Auto deploy: failed to fetch deployment pipeline '${pipelineName}' ` +
          `(status ${response?.status}). No release bindings were created; ` +
          `use the Deploy tab to deploy the project per environment.`,
      );
      return { created: [], failed: [] };
    }
    environments = expandPipelineEnvironments(data);
  } catch (error) {
    logger.warn(
      `Auto deploy: failed to fetch deployment pipeline '${pipelineName}': ${error}. ` +
        `No release bindings were created; use the Deploy tab to deploy the project per environment.`,
    );
    return { created: [], failed: [] };
  }

  if (environments.length === 0) {
    logger.warn(
      `Auto deploy: deployment pipeline '${pipelineName}' has no environments; no release bindings created.`,
    );
    return { created: [], failed: [] };
  }

  // Fan out over all environments concurrently. Each task resolves to the
  // created binding name or rejects with a contextual message; allSettled
  // preserves input order so results map back to `environments` by index.
  const results = await Promise.allSettled(
    environments.map(async environment => {
      const bindingName = `${projectName}-${environment}`;
      try {
        const { error, response } = await client.POST(
          '/api/v1/namespaces/{namespaceName}/projectreleasebindings',
          {
            params: {
              path: { namespaceName },
            },
            body: {
              metadata: {
                name: bindingName,
                namespace: namespaceName,
              },
              spec: {
                owner: {
                  projectName,
                },
                environment,
              },
            },
          },
        );
        if (response.ok) {
          logger.info(`Auto deploy: created release binding '${bindingName}'`);
        } else if (response.status === 409) {
          logger.info(
            `Auto deploy: release binding '${bindingName}' already exists`,
          );
        } else {
          throw new Error(
            `(status ${response.status})${
              error ? `: ${JSON.stringify(error)}` : ''
            }`,
          );
        }
        return bindingName;
      } catch (error) {
        throw new Error(
          `failed to create release binding '${bindingName}': ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }),
  );

  const created: string[] = [];
  const failures: string[] = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      created.push(result.value);
    } else {
      failures.push(environments[index]);
      logger.warn(`Auto deploy: ${result.reason.message}`);
    }
  });

  if (failures.length > 0) {
    logger.warn(
      `Auto deploy: created ${created.length} of ${environments.length} release ` +
        `binding(s); ${failures.length} failed (${failures.join(', ')}). The ` +
        `project was created; use the Deploy tab to deploy the remaining ` +
        `environments.`,
    );
  }

  return { created, failed: failures };
};

export const createProjectAction = (
  config: Config,
  immediateCatalog: ImmediateCatalogService,
) => {
  return createTemplateAction({
    id: 'openchoreo:project:create',
    description: 'Create OpenChoreo Project',
    schema: {
      input: {
        namespaceName: z =>
          z.string({
            description: 'The name of the namespace to create the project in',
          }),
        projectName: z =>
          z.string({ description: 'The name of the project to create' }),
        displayName: z =>
          z
            .string({ description: 'The display name of the project' })
            .optional(),
        description: z =>
          z
            .string({ description: 'The description of the project' })
            .optional(),
        deploymentPipeline: z =>
          z.string({
            description: 'The deployment pipeline for the project',
          }),
        autoDeploy: z =>
          z
            .boolean({
              description:
                'Create one unpinned ProjectReleaseBinding per environment of ' +
                'the deployment pipeline after the project is created (default true)',
            })
            .optional(),
        typeKind: z =>
          z
            .enum(['ProjectType', 'ClusterProjectType'], {
              description:
                'Whether the selected project type is namespace-scoped (ProjectType) or cluster-scoped (ClusterProjectType)',
            })
            .optional(),
        typeName: z =>
          z
            .string({
              description:
                'Name of the (Cluster)ProjectType template the Project instantiates',
            })
            .optional(),
        parameters: z =>
          z
            .record(z.unknown(), {
              description:
                "Parameter values bound to the selected project type's schema",
            })
            .optional(),
      },
      output: {
        projectName: z =>
          z.string({ description: 'The name of the created project' }),
        namespaceName: z =>
          z.string({
            description: 'The namespace where the project was created',
          }),
        entityRef: z =>
          z.string({
            description: 'Entity reference for the created project',
          }),
        createdBindings: z =>
          z
            .array(z.string(), {
              description:
                'Names of the ProjectReleaseBindings created for auto deploy',
            })
            .optional(),
        autoDeployFailed: z =>
          z
            .boolean({
              description:
                'True when auto deploy could not create one or more release ' +
                'bindings. Drives the conditional manual-deploy warning on the ' +
                'task page.',
            })
            .optional(),
        failedEnvironments: z =>
          z
            .string({
              description:
                'Comma-separated list of environments whose release binding ' +
                'could not be created (empty when auto deploy succeeded).',
            })
            .optional(),
      },
    },
    async handler(ctx) {
      ctx.logger.debug(
        `Creating project with parameters: ${JSON.stringify(ctx.input)}`,
      );

      // Extract namespace name from domain format (e.g., "domain:default/default-ns" -> "default-ns")
      const extractNamespaceName = (fullNamespaceName: string): string => {
        const parts = fullNamespaceName.split('/');
        return parts[parts.length - 1];
      };

      const namespaceName = extractNamespaceName(ctx.input.namespaceName);
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

      const { typeKind, typeName, parameters } = ctx.input;
      const hasParameters = parameters && Object.keys(parameters).length > 0;

      // Build the Project spec. `type` (ProjectTypeRef) and `parameters` are
      // populated when the Project is created from a per-ProjectType template;
      // when omitted the OpenChoreo API defaults `type` to the cluster-scoped
      // `default` ClusterProjectType, preserving back-compat with callers that
      // don't pass a type (e.g. the legacy create path).
      const spec: Record<string, unknown> = {
        deploymentPipelineRef: {
          kind: 'DeploymentPipeline' as const,
          name: ctx.input.deploymentPipeline,
        },
        ...(typeName && {
          type: { kind: typeKind ?? 'ProjectType', name: typeName },
        }),
        ...(hasParameters && { parameters }),
      };

      const apiBody: Record<string, unknown> = {
        metadata: {
          name: ctx.input.projectName,
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
        spec,
      };

      try {
        const { data, error, response } = await client.POST(
          '/api/v1/namespaces/{namespaceName}/projects',
          {
            params: {
              path: { namespaceName },
            },
            body: apiBody as any,
          },
        );

        assertApiResponse({ data, error, response }, 'create project');

        ctx.logger.debug(
          `Project created successfully: ${JSON.stringify(data)}`,
        );

        const projectName = data?.metadata?.name || ctx.input.projectName;

        // Immediately insert the project into the catalog
        try {
          ctx.logger.info(
            `Inserting project '${projectName}' into catalog immediately...`,
          );

          const defaultOwner =
            config.getOptionalString('openchoreo.defaultOwner') ||
            'openchoreo-users';

          const annotations = data?.metadata?.annotations || {};
          const entity = translateProjectToEntity(
            {
              name: projectName,
              displayName:
                ctx.input.displayName ||
                annotations['openchoreo.dev/display-name'],
              description:
                ctx.input.description ||
                annotations['openchoreo.dev/description'],
              namespaceName: namespaceName,
              uid: data?.metadata?.uid,
              ...(typeName && { projectTypeName: typeName }),
              ...(typeKind && { projectTypeKind: typeKind }),
            },
            namespaceName,
            {
              locationKey: 'provider:OpenChoreoEntityProvider',
              defaultOwner: `group:default/${defaultOwner}`,
            },
          );

          await immediateCatalog.insertEntity(entity);

          ctx.logger.info(
            `Project '${projectName}' successfully added to catalog`,
          );
        } catch (catalogError) {
          ctx.logger.error(
            `Failed to immediately add project to catalog: ${catalogError}. ` +
              `Project will be visible after the next scheduled catalog sync.`,
          );
        }

        const autoDeploy = ctx.input.autoDeploy ?? true;
        let createdBindings: string[] = [];
        let failedBindings: string[] = [];
        if (autoDeploy) {
          ({ created: createdBindings, failed: failedBindings } =
            await createInitialReleaseBindings({
              client,
              logger: ctx.logger,
              namespaceName,
              projectName,
              // Mirror the openchoreo-api service default so both sides agree
              // when no pipeline is picked.
              pipelineName: ctx.input.deploymentPipeline || 'default',
            }));
        } else {
          ctx.logger.info('Auto deploy disabled - no release bindings created');
        }

        // Drive the conditional manual-deploy warning on the task page
        // (rendered below the "View Project" link) when auto deploy could not
        // create some bindings. The template's output.text entry has an `if`
        // condition bound to autoDeployFailed, so no card shows on success.
        ctx.output('projectName', projectName);
        ctx.output('namespaceName', namespaceName);
        ctx.output('entityRef', `system:${namespaceName}/${projectName}`);
        ctx.output('createdBindings', createdBindings);
        ctx.output('autoDeployFailed', failedBindings.length > 0);
        ctx.output('failedEnvironments', failedBindings.join(', '));
      } catch (error) {
        ctx.logger.error(`Error creating project: ${error}`);
        throw error instanceof Error
          ? error
          : new Error(`Failed to create project: ${String(error)}`);
      }
    },
  });
};
