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
    description:
      'Traits developers may attach to components of this type, as Kind/name (Trait/name or ClusterTrait/name)',
  },
  openchoreoEmbeddedTraits: {
    type: 'set',
    description:
      'Traits every component of this type gets, as Kind/name (Trait/name or ClusterTrait/name)',
  },
  openchoreoAllowedWorkflows: {
    type: 'set',
    description:
      'Build workflows components of this type may use, as Kind/name (Workflow/name or ClusterWorkflow/name)',
  },
  openchoreoValidationRuleCount: {
    type: 'integer',
    description:
      'Validation rules checked before and after a component is rendered',
  },
  openchoreoTemplatesSetResourceLimits: {
    type: 'boolean',
    description:
      'Whether every container written out in the templates sets CPU and memory limits that oc_omit() cannot drop. Pod specs, container lists and containers written as CEL expressions are not checked',
  },
  openchoreoTemplatesRunAsNonRoot: {
    type: 'boolean',
    description:
      'Whether every container written out in the templates sets runAsNonRoot or a non-zero runAsUser as a literal value. A securityContext written as a CEL expression does not count. Pod specs, container lists and containers written as CEL expressions are not checked',
  },
  openchoreoTemplatesAllowPrivileged: {
    type: 'boolean',
    description:
      'Whether any container written out in the templates sets privileged to anything other than false, or writes its securityContext as a CEL expression. Pod specs, container lists and containers written as CEL expressions are not checked',
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
        async (entity, client, signal) => {
          const name = entity.metadata.name;
          const clusterScoped =
            entity.kind.toLowerCase() === 'clustercomponenttype';
          const { data, response } = clusterScoped
            ? await client.GET('/api/v1/clustercomponenttypes/{cctName}', {
                params: { path: { cctName: name } },
                signal,
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
                  signal,
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
          return componentTypeFacts((data.spec ?? {}) as ComponentTypeSpec, {
            clusterScoped,
          });
        },
      ),
  };
}
