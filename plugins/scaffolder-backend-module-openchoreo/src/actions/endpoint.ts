import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import {
  createOpenChoreoApiClient,
  assertApiResponse,
} from '@openchoreo/openchoreo-client-node';
import { Config } from '@backstage/config';
import {
  type ImmediateCatalogService,
  translateEndpointToEntities,
} from '@openchoreo/backstage-plugin-catalog-backend-module';

// Kubernetes DNS label: Endpoint names are also used to name its bindings
// and routes.
const K8S_NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
const MAX_NAME_LENGTH = 63;

/** Strips a Backstage entity ref prefix (`domain:default/acme`) to the name. */
function stripEntityRefPrefix(value: string): string {
  const parts = value.split('/');
  return parts[parts.length - 1];
}

/**
 * Scaffolder action that creates an OpenChoreo Endpoint and immediately
 * inserts it, and the API entity carrying its schema when it has one, into
 * the catalog. Takes the structured input of the per-type templates generated
 * by `EtdToTemplateConverter`. Mirrors `openchoreo:resource:create`.
 */
export const createEndpointAction = (
  config: Config,
  immediateCatalog: ImmediateCatalogService,
) => {
  return createTemplateAction({
    id: 'openchoreo:endpoint:create',
    description: 'Create OpenChoreo Endpoint',
    schema: {
      input: {
        namespaceName: z =>
          z.string({
            description: 'Namespace where the Endpoint will be created',
          }),
        projectName: z =>
          z.string({ description: 'Project that will own the Endpoint' }),
        endpointName: z =>
          z
            .string({ description: 'Unique name for the Endpoint' })
            .max(
              MAX_NAME_LENGTH,
              `Endpoint name must not exceed ${MAX_NAME_LENGTH} characters`,
            )
            .regex(
              K8S_NAME_PATTERN,
              'Endpoint name must be lowercase letters, numbers or hyphens, starting and ending with a letter or number.',
            ),
        displayName: z => z.string().optional(),
        description: z => z.string().optional(),
        typeKind: z =>
          z.enum(['EndpointType', 'ClusterEndpointType'], {
            description:
              'Whether the type is namespace-scoped (EndpointType) or cluster-scoped (ClusterEndpointType)',
          }),
        typeName: z =>
          z.string({ description: 'Name of the (Cluster)EndpointType' }),
        visibility: z =>
          z
            .array(z.enum(['namespace', 'internal', 'external']), {
              description: 'Scopes the Endpoint exposes its backends to',
            })
            .min(1, 'Select at least one visibility'),
        backends: z =>
          z
            .array(
              z.object({
                name: z.string(),
                component: z.string(),
                endpoint: z.string(),
                weight: z.number().int().min(0).optional(),
              }),
              {
                description:
                  'Component workload endpoints to route traffic to, with relative weights',
              },
            )
            .min(1, 'Add at least one backend'),
        schema: z =>
          z
            .object({
              type: z.string().optional(),
              content: z.string().optional(),
            })
            .optional(),
        parameters: z =>
          z
            .record(z.unknown(), {
              description: "Parameter values bound to the type's schema",
            })
            .optional(),
      },
      output: {
        endpointName: z =>
          z.string({ description: 'The name of the created Endpoint' }),
        namespaceName: z =>
          z.string({ description: 'The namespace of the created Endpoint' }),
        projectName: z =>
          z.string({ description: 'The project that owns the Endpoint' }),
        entityRef: z =>
          z.string({ description: 'Entity reference for the Endpoint' }),
      },
    },
    async handler(ctx) {
      const namespaceName = stripEntityRefPrefix(ctx.input.namespaceName);
      const projectName = stripEntityRefPrefix(ctx.input.projectName);
      const {
        endpointName,
        displayName,
        description,
        typeKind,
        typeName,
        visibility,
        backends,
        schema,
        parameters,
      } = ctx.input;

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

      const annotations: Record<string, string> = {};
      if (displayName) {
        annotations['openchoreo.dev/display-name'] = displayName;
      }
      if (description) {
        annotations['openchoreo.dev/description'] = description;
      }
      const hasParameters = parameters && Object.keys(parameters).length > 0;
      // A schema with no content is no schema: the Endpoint then gets no
      // API entity.
      const endpointSchema = schema?.content?.trim()
        ? {
            ...(schema.type && { type: schema.type }),
            content: schema.content,
          }
        : undefined;

      const apiBody = {
        metadata: {
          name: endpointName,
          ...(Object.keys(annotations).length > 0 && { annotations }),
        },
        spec: {
          owner: { projectName },
          type: { kind: typeKind, name: typeName },
          visibility,
          backendRefs: backends.map(b => ({
            name: b.name,
            kind: 'Component',
            component: { name: b.component, endpoint: b.endpoint },
            ...(b.weight !== undefined && { weight: b.weight }),
          })),
          ...(endpointSchema && { schema: endpointSchema }),
          ...(hasParameters && { parameters }),
        },
      };

      ctx.logger.info(
        `Creating Endpoint '${endpointName}' in namespace '${namespaceName}'`,
      );
      const { data, error, response } = await client.POST(
        '/api/v1/namespaces/{namespaceName}/endpoints',
        {
          params: { path: { namespaceName } },
          body: apiBody as any,
        },
      );
      assertApiResponse({ data, error, response }, 'create Endpoint');

      const metadata = (data as { metadata?: Record<string, unknown> })
        ?.metadata;
      const resultName = (metadata?.name as string) || endpointName;

      try {
        const defaultOwner =
          config.getOptionalString('openchoreo.defaultOwner') ||
          'openchoreo-users';
        const entities = translateEndpointToEntities(
          {
            name: resultName,
            uid: metadata?.uid as string | undefined,
            displayName,
            description,
            projectName,
            typeName,
            typeKind,
            visibility,
            backends: backends.map(b => ({
              name: b.name,
              kind: 'Component',
              component: b.component,
              endpoint: b.endpoint,
              ...(b.weight !== undefined && { weight: b.weight }),
            })),
            schema: endpointSchema,
            createdAt: new Date().toISOString(),
          },
          namespaceName,
          {
            locationKey: 'OpenChoreoEntityProvider',
            defaultOwner: `group:default/${defaultOwner}`,
          },
        );
        for (const entity of entities) {
          await immediateCatalog.insertEntity(entity);
        }
      } catch (catalogError) {
        ctx.logger.error(
          `Failed to immediately add Endpoint to catalog: ${catalogError}. ` +
            `It will be visible after the next scheduled catalog sync.`,
        );
      }

      ctx.output('endpointName', resultName);
      ctx.output('namespaceName', namespaceName);
      ctx.output('projectName', projectName);
      ctx.output('entityRef', `endpoint:${namespaceName}/${resultName}`);
    },
  });
};
