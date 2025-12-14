import {
  Entity,
  ANNOTATION_LOCATION,
  ANNOTATION_ORIGIN_LOCATION,
} from '@backstage/catalog-model';
import {
  CHOREO_ANNOTATIONS,
  CHOREO_LABELS,
} from '@openchoreo/backstage-plugin-common';
import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';

// Use generated types from OpenAPI spec
type ModelsOrganization =
  OpenChoreoComponents['schemas']['OrganizationResponse'];
type ModelsProject = OpenChoreoComponents['schemas']['ProjectResponse'];
type ModelsComponent = OpenChoreoComponents['schemas']['ComponentResponse'];
type ModelsCompleteComponent =
  OpenChoreoComponents['schemas']['ComponentResponse'];

// WorkloadEndpoint is part of the workload.endpoints structure
interface WorkloadEndpoint {
  type: string;
  port: number;
  schema?: {
    content?: string;
  };
}

export class EntityTranslator {
  private readonly providerName: string;

  constructor(providerName: string) {
    this.providerName = providerName;
  }

  translateOrganizationToDomain(organization: ModelsOrganization): Entity {
    const domainEntity: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Domain',
      metadata: {
        name: organization.name!,
        title: organization.displayName || organization.name!,
        description: organization.description || organization.name!,
        tags: ['openchoreo', 'organization', 'domain'],
        annotations: {
          [ANNOTATION_LOCATION]: `provider:${this.providerName}`,
          [ANNOTATION_ORIGIN_LOCATION]: `provider:${this.providerName}`,
          [CHOREO_ANNOTATIONS.ORGANIZATION]: organization.name!,
          ...(organization.namespace && {
            [CHOREO_ANNOTATIONS.NAMESPACE]: organization.namespace,
          }),
          ...(organization.createdAt && {
            [CHOREO_ANNOTATIONS.CREATED_AT]: organization.createdAt,
          }),
          ...(organization.status && {
            [CHOREO_ANNOTATIONS.STATUS]: organization.status,
          }),
        },
        labels: {
          'openchoreo.io/managed': 'true',
        },
      },
      spec: {
        owner: 'guests',
      },
    };

    return domainEntity;
  }

  translateProjectToEntity(project: ModelsProject, orgName: string): Entity {
    const systemEntity: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'System',
      metadata: {
        name: project.name!,
        title: project.displayName || project.name!,
        description: project.description || project.name!,
        tags: ['openchoreo', 'project'],
        annotations: {
          [ANNOTATION_LOCATION]: `provider:${this.providerName}`,
          [ANNOTATION_ORIGIN_LOCATION]: `provider:${this.providerName}`,
          [CHOREO_ANNOTATIONS.PROJECT_ID]: project.name!,
          [CHOREO_ANNOTATIONS.ORGANIZATION]: orgName,
        },
        labels: {
          [CHOREO_LABELS.MANAGED]: 'true',
        },
      },
      spec: {
        owner: 'guests',
        domain: orgName,
      },
    };

    return systemEntity;
  }

  translateComponentToEntity(
    component: ModelsComponent,
    orgName: string,
    projectName: string,
    providesApis?: string[],
  ): Entity {
    let backstageComponentType: string = (
      component.type || 'service'
    ).toLowerCase();
    if (component.type === 'WebApplication') {
      backstageComponentType = 'website';
    }

    // Extract repository info from componentWorkflow (new structure)
    const repositoryUrl =
      component.componentWorkflow?.systemParameters?.repository?.url;
    const branch =
      component.componentWorkflow?.systemParameters?.repository?.revision
        ?.branch;

    const componentEntity: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: component.name!,
        title: component.name!,
        description: component.description || component.name!,
        tags: [
          'openchoreo',
          'component',
          (component.type || 'service').toLowerCase(),
        ],
        annotations: {
          [ANNOTATION_LOCATION]: `provider:${this.providerName}`,
          [ANNOTATION_ORIGIN_LOCATION]: `provider:${this.providerName}`,
          [CHOREO_ANNOTATIONS.COMPONENT]: component.name!,
          ...(component.type && {
            [CHOREO_ANNOTATIONS.COMPONENT_TYPE]: component.type,
          }),
          [CHOREO_ANNOTATIONS.PROJECT]: projectName,
          [CHOREO_ANNOTATIONS.ORGANIZATION]: orgName,
          ...(component.createdAt && {
            [CHOREO_ANNOTATIONS.CREATED_AT]: component.createdAt,
          }),
          ...(component.status && {
            [CHOREO_ANNOTATIONS.STATUS]: component.status,
          }),
          ...(repositoryUrl && {
            'backstage.io/source-location': `url:${repositoryUrl}`,
          }),
          ...(branch && {
            [CHOREO_ANNOTATIONS.BRANCH]: branch,
          }),
        },
        labels: {
          [CHOREO_LABELS.MANAGED]: 'true',
        },
      },
      spec: {
        type: backstageComponentType,
        lifecycle: (component.status || 'active').toLowerCase(),
        owner: 'guests',
        system: projectName,
        ...(providesApis && providesApis.length > 0 && { providesApis }),
      },
    };

    return componentEntity;
  }

  translateServiceComponentToEntity(
    completeComponent: ModelsCompleteComponent,
    orgName: string,
    projectName: string,
  ): Entity {
    // Generate API names for providesApis
    const providesApis: string[] = [];
    if (completeComponent.workload?.endpoints) {
      Object.keys(completeComponent.workload.endpoints).forEach(
        endpointName => {
          providesApis.push(`${completeComponent.name}-${endpointName}`);
        },
      );
    }

    // Reuse the base translateComponentToEntity method
    return this.translateComponentToEntity(
      completeComponent,
      orgName,
      projectName,
      providesApis,
    );
  }

  // Wrapper demanded by implementation plan for clarity during cursor traversal
  processServiceComponentWithCursor(
    completeComponent: ModelsCompleteComponent,
    orgName: string,
    projectName: string,
  ): { componentEntity: Entity; apiEntities: Entity[] } {
    const componentEntity = this.translateServiceComponentToEntity(
      completeComponent,
      orgName,
      projectName,
    );
    const apiEntities = this.createApiEntitiesFromWorkload(
      completeComponent,
      orgName,
      projectName,
    );
    return { componentEntity, apiEntities };
  }

  createApiEntitiesFromWorkload(
    completeComponent: ModelsCompleteComponent,
    orgName: string,
    projectName: string,
  ): Entity[] {
    const apiEntities: Entity[] = [];

    if (!completeComponent.workload?.endpoints) {
      return apiEntities;
    }

    Object.entries(completeComponent.workload.endpoints).forEach(
      ([endpointName, endpoint]) => {
        const workloadEndpoint = endpoint as WorkloadEndpoint;
        const apiEntity: Entity = {
          apiVersion: 'backstage.io/v1alpha1',
          kind: 'API',
          metadata: {
            name: `${completeComponent.name}-${endpointName}`,
            title: `${completeComponent.name} ${endpointName} API`,
            description: `${workloadEndpoint.type} endpoint for ${completeComponent.name} service on port ${workloadEndpoint.port}`,
            tags: ['openchoreo', 'api', workloadEndpoint.type.toLowerCase()],
            annotations: {
              [ANNOTATION_LOCATION]: `provider:${this.providerName}`,
              [ANNOTATION_ORIGIN_LOCATION]: `provider:${this.providerName}`,
              [CHOREO_ANNOTATIONS.COMPONENT]: completeComponent.name!,
              [CHOREO_ANNOTATIONS.ENDPOINT_NAME]: endpointName,
              [CHOREO_ANNOTATIONS.ENDPOINT_TYPE]: workloadEndpoint.type,
              [CHOREO_ANNOTATIONS.ENDPOINT_PORT]:
                workloadEndpoint.port.toString(),
              [CHOREO_ANNOTATIONS.PROJECT]: projectName,
              [CHOREO_ANNOTATIONS.ORGANIZATION]: orgName,
            },
            labels: {
              [CHOREO_LABELS.MANAGED]: 'true',
            },
          },
          spec: {
            type: this.mapWorkloadEndpointTypeToBackstageType(
              workloadEndpoint.type,
            ),
            lifecycle: 'production',
            owner: 'guests',
            system: projectName,
            definition:
              this.createApiDefinitionFromWorkloadEndpoint(workloadEndpoint),
          },
        };

        apiEntities.push(apiEntity);
      },
    );

    return apiEntities;
  }

  private mapWorkloadEndpointTypeToBackstageType(workloadType: string): string {
    switch (workloadType) {
      case 'REST':
      case 'HTTP':
        return 'openapi';
      case 'GraphQL':
        return 'graphql';
      case 'gRPC':
        return 'grpc';
      case 'Websocket':
        return 'asyncapi';
      case 'TCP':
      case 'UDP':
        return 'openapi'; // Default to openapi for TCP/UDP
      default:
        return 'openapi';
    }
  }

  private createApiDefinitionFromWorkloadEndpoint(
    endpoint: WorkloadEndpoint,
  ): string {
    if (endpoint.schema?.content) {
      return endpoint.schema.content;
    }
    return 'No schema available';
  }
}
