import { Entity } from '@backstage/catalog-model';
import { JSONSchema7 } from 'json-schema';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

/** Namespace for templates generated from cluster-scoped ClusterEndpointTypes. */
const CLUSTER_TEMPLATE_NAMESPACE = 'openchoreo-cluster';

/**
 * (Cluster)EndpointType shape consumed by the converter. The two scopes
 * differ only in the namespace the generated Template lives in.
 */
export interface EndpointTypeCRD {
  metadata: {
    name: string;
    displayName?: string;
    description?: string;
  };
  spec: {
    parameters?: {
      openAPIV3Schema?: JSONSchema7;
    };
  };
}

export interface EtdConverterConfig {
  /** Default owner for generated templates (required by the Template kind schema). */
  defaultOwner?: string;
}

type EtdKind = 'EndpointType' | 'ClusterEndpointType';

/**
 * Converts OpenChoreo (Cluster)EndpointType CRDs into Backstage scaffolder
 * Template entities, one per type, mirroring `RtdToTemplateConverter`.
 * `ETD` (EndpointType Definition) covers both scopes; the actual kind is on
 * the template's `openchoreo.io/etd-kind` annotation.
 *
 * The wizard collects the Endpoint's name, the scopes it is exposed to, its
 * backends (component workload endpoints with weights), an optional schema
 * pre-filled from the first backend's workload endpoint, and the type's
 * parameters.
 */
export class EtdToTemplateConverter {
  private readonly defaultOwner: string;

  constructor(config?: EtdConverterConfig) {
    this.defaultOwner = config?.defaultOwner || 'guests';
  }

  /** Convert a namespace-scoped EndpointType to a scaffolder Template entity. */
  convertEtdToTemplateEntity(
    et: EndpointTypeCRD,
    namespaceName: string,
  ): Entity {
    return this.buildTemplate(et, namespaceName, 'EndpointType');
  }

  /**
   * Convert a ClusterEndpointType to a scaffolder Template entity in the
   * `openchoreo-cluster` namespace. The developer picks the project and
   * namespace explicitly.
   */
  convertClusterEtdToTemplateEntity(cet: EndpointTypeCRD): Entity {
    return this.buildTemplate(
      cet,
      CLUSTER_TEMPLATE_NAMESPACE,
      'ClusterEndpointType',
    );
  }

  private buildTemplate(
    et: EndpointTypeCRD,
    templateNamespace: string,
    etdKind: EtdKind,
  ): Entity {
    const title = et.metadata.displayName || formatTitle(et.metadata.name);
    // Cluster templates must not pre-fill `openchoreo-cluster`, which is not
    // a user namespace.
    const defaultNamespace =
      etdKind === 'ClusterEndpointType' ? '' : templateNamespace;

    const templateEntity: Entity = {
      apiVersion: 'scaffolder.backstage.io/v1beta3',
      kind: 'Template',
      metadata: {
        name: endpointTemplateName(et.metadata.name),
        namespace: templateNamespace,
        title,
        description:
          et.metadata.description || `Create an endpoint routed by ${title}`,
        annotations: {
          [CHOREO_ANNOTATIONS.ETD_NAME]: et.metadata.name,
          [CHOREO_ANNOTATIONS.ETD_GENERATED]: 'true',
          [CHOREO_ANNOTATIONS.ETD_KIND]: etdKind,
          ...(et.metadata.displayName && {
            [CHOREO_ANNOTATIONS.ETD_DISPLAY_NAME]: et.metadata.displayName,
          }),
        },
      },
      spec: {
        owner: this.defaultOwner,
        type: 'Endpoint',
        EXPERIMENTAL_formDecorators: [{ id: 'openchoreo:inject-user-token' }],
        parameters: this.generateParameters(
          et,
          defaultNamespace,
          etdKind,
          title,
        ),
        steps: this.generateSteps(et, etdKind),
        output: {
          links: [
            {
              title: 'View Endpoint',
              icon: 'kind:endpoint',
              entityRef:
                "endpoint:${{ steps['create-endpoint'].output.namespaceName }}/${{ steps['create-endpoint'].output.endpointName }}",
            },
          ],
        },
      } as any,
    };

    return templateEntity;
  }

  private generateParameters(
    et: EndpointTypeCRD,
    defaultNamespace: string,
    etdKind: EtdKind,
    title: string,
  ): any[] {
    const metadataSection = {
      title: 'Endpoint Metadata',
      required: ['project_namespace', 'endpoint_name'],
      properties: {
        project_namespace: {
          title: 'Project & Namespace',
          type: 'object',
          'ui:field': 'ProjectNamespaceField',
          'ui:options': { defaultNamespace },
          properties: {
            project_name: { type: 'string' },
            namespace_name: { type: 'string' },
          },
          required: ['project_name', 'namespace_name'],
        },
        endpoint_name: {
          title: 'Endpoint Name',
          type: 'string',
          description:
            'Unique name for your Endpoint (must be a valid Kubernetes name)',
          'ui:field': 'ResourceNamePicker',
          'ui:options': {
            catalogKind: 'Endpoint',
            resourceLabel: 'Endpoint',
            namespaceField: 'project_namespace.namespace_name',
          },
        },
        displayName: {
          title: 'Display Name',
          type: 'string',
          description: 'A human-readable display name for the Endpoint',
        },
        description: {
          title: 'Description',
          type: 'string',
          description: 'Describe what this Endpoint exposes',
        },
      },
    };

    const routingSection = {
      title: 'Routing',
      required: ['visibility', 'backends'],
      properties: {
        visibility: {
          title: 'Visibility',
          description: 'Scopes to expose this Endpoint to',
          type: 'array',
          items: {
            type: 'string',
            enum: ['namespace', 'internal', 'external'],
          },
          uniqueItems: true,
          minItems: 1,
          default: ['external'],
          'ui:widget': 'checkboxes',
        },
        backends: {
          title: 'Backends',
          description:
            'Component workload endpoints to route traffic to, with relative weights',
          type: 'array',
          minItems: 1,
          'ui:field': 'EndpointBackendsField',
          'ui:options': {
            projectNamespaceField: 'project_namespace',
          },
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              component: { type: 'string' },
              endpoint: { type: 'string' },
              weight: { type: 'number' },
            },
            required: ['name', 'component', 'endpoint'],
          },
        },
        schema: {
          title: 'API Schema',
          type: 'object',
          'ui:field': 'EndpointSchemaField',
          'ui:options': {
            projectNamespaceField: 'project_namespace',
            backendsField: 'backends',
          },
          properties: {
            type: { type: 'string' },
            content: { type: 'string' },
          },
        },
      },
    };

    const detailsUiOptions: Record<string, unknown> = {
      rtdName: et.metadata.name,
      rtdKind: etdKind,
      rtdDisplayName: title,
    };
    if (et.spec.parameters?.openAPIV3Schema) {
      detailsUiOptions.rtdSchema = et.spec.parameters.openAPIV3Schema;
    }

    const detailsSection = {
      title: `${title} Details`,
      properties: {
        parameters: {
          title: 'Parameters',
          type: 'object',
          'ui:field': 'ResourceParametersField',
          'ui:options': detailsUiOptions,
        },
      },
    };

    return [metadataSection, routingSection, detailsSection];
  }

  private generateSteps(et: EndpointTypeCRD, etdKind: EtdKind): any[] {
    return [
      {
        id: 'create-endpoint',
        name: 'Create OpenChoreo Endpoint',
        action: 'openchoreo:endpoint:create',
        input: {
          namespaceName: '${{ parameters.project_namespace.namespace_name }}',
          projectName: '${{ parameters.project_namespace.project_name }}',
          endpointName: '${{ parameters.endpoint_name }}',
          displayName: '${{ parameters.displayName }}',
          description: '${{ parameters.description }}',
          typeKind: etdKind,
          typeName: et.metadata.name,
          visibility: '${{ parameters.visibility }}',
          backends: '${{ parameters.backends }}',
          schema: '${{ parameters.schema }}',
          parameters: '${{ parameters.parameters }}',
        },
      },
    ];
  }
}

/** Template name format: `template-endpoint-<etd-name>`. */
export function endpointTemplateName(etName: string): string {
  return `template-endpoint-${etName}`;
}

/** Format `http-route` → `Http Route`. */
function formatTitle(name: string): string {
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
