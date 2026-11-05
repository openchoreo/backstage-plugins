import type { FactRetriever } from '@backstage-community/plugin-tech-insights-node';
import type { OpenChoreoTokenService } from '@openchoreo/openchoreo-auth';
import {
  collectOpenChoreoFacts,
  createServiceClient,
  unresolvedFacts,
} from './collectOpenChoreoFacts';
import {
  componentTypeFacts,
  type ComponentTypeSpec,
} from './componentTypeFacts';

export const OPENCHOREO_COMPONENT_TYPE_FACT_RETRIEVER_ID =
  'openchoreoComponentTypeFactRetriever';

const schema: FactRetriever['schema'] = {
  openchoreoComponentTypeResolved: {
    type: 'boolean',
    description:
      'Whether the component type was found in OpenChoreo. When false, every other fact is null.',
  },
  openchoreoWorkloadType: {
    type: 'string',
    description:
      'Workload the component type renders: deployment, statefulset, cronjob, job or proxy',
  },
  openchoreoAllowedTraits: {
    type: 'set',
    description: 'Traits developers may attach to components of this type',
  },
  openchoreoEmbeddedTraits: {
    type: 'set',
    description: 'Traits every component of this type gets',
  },
  openchoreoAllowedWorkflows: {
    type: 'set',
    description: 'Build workflows components of this type may use',
  },
  openchoreoValidationRuleCount: {
    type: 'integer',
    description: 'Validation rules checked when a component is rendered',
  },
  openchoreoTemplatesSetResourceLimits: {
    type: 'boolean',
    description:
      'Whether every container in the templates sets CPU and memory limits',
  },
  openchoreoTemplatesRunAsNonRoot: {
    type: 'boolean',
    description:
      'Whether every container in the templates sets runAsNonRoot or a non-zero runAsUser as a literal value',
  },
  openchoreoTemplatesAllowPrivileged: {
    type: 'boolean',
    description:
      'Whether any container in the templates sets privileged to anything other than false',
  },
};

const UNRESOLVED_FACTS = unresolvedFacts(
  schema,
  'openchoreoComponentTypeResolved',
);

export function createOpenChoreoComponentTypeFactRetriever(
  tokenService: OpenChoreoTokenService,
): FactRetriever {
  return {
    id: OPENCHOREO_COMPONENT_TYPE_FACT_RETRIEVER_ID,
    version: '0.1.0',
    title: 'OpenChoreo Component Type',
    description:
      'What an OpenChoreo component type allows and how its templates run containers, read from the OpenChoreo API.',
    entityFilter: [{ kind: ['ClusterComponentType', 'ComponentType'] }],
    schema,
    handler: context =>
      collectOpenChoreoFacts(
        context,
        () => createServiceClient(context, tokenService),
        async (entity, client) => {
          const name = entity.metadata.name;
          const { data, response } =
            entity.kind.toLowerCase() === 'clustercomponenttype'
              ? await client.GET('/api/v1/clustercomponenttypes/{cctName}', {
                  params: { path: { cctName: name } },
                })
              : await client.GET(
                  '/api/v1/namespaces/{namespaceName}/componenttypes/{ctName}',
                  {
                    params: {
                      path: {
                        namespaceName: entity.metadata.namespace ?? 'default',
                        ctName: name,
                      },
                    },
                  },
                );
          if (response.status === 404) {
            return UNRESOLVED_FACTS;
          }
          if (!data) {
            throw new Error(
              `GET ${entity.kind} ${name} returned HTTP ${response.status}`,
            );
          }
          return componentTypeFacts((data.spec ?? {}) as ComponentTypeSpec);
        },
      ),
  };
}
