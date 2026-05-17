import { Entity } from '@backstage/catalog-model';
import { JSONSchema7 } from 'json-schema';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

/**
 * Namespace used for cluster-scoped template entities (those generated
 * from `ClusterResourceType` rather than namespace-scoped `ResourceType`).
 * Matches the convention used by `CtdToTemplateConverter`.
 */
const CLUSTER_TEMPLATE_NAMESPACE = 'openchoreo-cluster';

/**
 * ResourceType CRD shape consumed by the converter. Covers both
 * namespace-scoped `ResourceType` and cluster-scoped `ClusterResourceType`
 * — the only behavioural difference between the two is the namespace the
 * generated Template lives in, handled by the separate
 * `convertClusterRtdToTemplateEntity` entrypoint added in a follow-up slice.
 */
export interface ResourceTypeCRD {
  metadata: {
    name: string;
    displayName?: string;
    description?: string;
    tags?: string[];
    createdAt?: string;
  };
  spec: {
    parameters?: {
      openAPIV3Schema?: JSONSchema7;
    };
    outputs?: Array<{ name: string; kind?: string }>;
    retainPolicy?: 'Delete' | 'Retain';
  };
}

export interface RtdConverterConfig {
  /** Default owner for generated templates (required by the Template kind schema). */
  defaultOwner?: string;
}

type RtdKind = 'ResourceType' | 'ClusterResourceType';

/**
 * Converts OpenChoreo (Cluster)ResourceType CRDs into Backstage scaffolder
 * Template entities. Mirrors the Component-side `CtdToTemplateConverter`:
 * each ResourceType becomes a per-type wizard.
 *
 * `RTD` (ResourceType Definition) is the umbrella term covering both
 * scopes; the actual K8s kind lives on the generated Template entity's
 * `openchoreo.io/rtd-kind` annotation as either `ResourceType` or
 * `ClusterResourceType`. Parallels CTD/CT/CCT on the Component side.
 *
 * The generated template emits one schema-driven `parameters` field via the
 * `ResourceParametersField` extension; the rendered form is built from
 * `spec.parameters.openAPIV3Schema` at runtime.
 */
export class RtdToTemplateConverter {
  private readonly defaultOwner: string;

  constructor(config?: RtdConverterConfig) {
    this.defaultOwner = config?.defaultOwner || 'guests';
  }

  /** Convert a namespace-scoped ResourceType to a scaffolder Template entity. */
  convertRtdToTemplateEntity(
    rt: ResourceTypeCRD,
    namespaceName: string,
  ): Entity {
    return this.buildTemplate(rt, namespaceName, 'ResourceType');
  }

  /**
   * Convert a cluster-scoped ClusterResourceType to a scaffolder Template
   * entity living in the `openchoreo-cluster` namespace. The generated
   * template's `ProjectNamespaceField` has no default namespace pre-fill;
   * the developer picks both project and namespace explicitly.
   */
  convertClusterRtdToTemplateEntity(crt: ResourceTypeCRD): Entity {
    return this.buildTemplate(
      crt,
      CLUSTER_TEMPLATE_NAMESPACE,
      'ClusterResourceType',
    );
  }

  private buildTemplate(
    rt: ResourceTypeCRD,
    templateNamespace: string,
    rtdKind: RtdKind,
  ): Entity {
    const templateName = this.generateTemplateName(rt.metadata.name);
    const title = rt.metadata.displayName || this.formatTitle(rt.metadata.name);
    const description = rt.metadata.description || `Create a ${title} resource`;

    // For namespace-scoped templates, pre-fill the form's namespace dropdown
    // with the template's own namespace. For cluster-scoped templates the
    // user picks the deployment namespace explicitly — pre-filling
    // `openchoreo-cluster` would be wrong (it's not a user namespace).
    const defaultNamespace =
      rtdKind === 'ClusterResourceType' ? '' : templateNamespace;

    const templateEntity: Entity = {
      apiVersion: 'scaffolder.backstage.io/v1beta3',
      kind: 'Template',
      metadata: {
        name: templateName,
        namespace: templateNamespace,
        title,
        description,
        annotations: {
          [CHOREO_ANNOTATIONS.RTD_NAME]: rt.metadata.name,
          [CHOREO_ANNOTATIONS.RTD_GENERATED]: 'true',
          [CHOREO_ANNOTATIONS.RTD_KIND]: rtdKind,
        },
      },
      spec: {
        owner: this.defaultOwner,
        type: 'Resource',
        EXPERIMENTAL_formDecorators: [{ id: 'openchoreo:inject-user-token' }],
        parameters: this.generateParameters(
          rt,
          defaultNamespace,
          rtdKind,
          title,
        ),
        steps: this.generateSteps(rt, rtdKind),
        output: {
          links: [
            {
              title: 'View Resource',
              icon: 'kind:resource',
              entityRef:
                "resource:${{ steps['create-resource'].output.namespaceName }}/${{ steps['create-resource'].output.resourceName }}",
            },
          ],
        },
      } as any,
    };

    if (rt.metadata.displayName) {
      templateEntity.metadata.annotations![
        CHOREO_ANNOTATIONS.RTD_DISPLAY_NAME
      ] = rt.metadata.displayName;
    }

    return templateEntity;
  }

  /** Template name format: `template-resource-<rtd-name>`. */
  private generateTemplateName(rtName: string): string {
    return `template-resource-${rtName}`;
  }

  /** Format `message-queue` → `Message Queue`. */
  private formatTitle(name: string): string {
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Two parameter sections:
   *   1. Resource Metadata — project_namespace + resource_name (+ display name / description)
   *   2. <Display Name> Details — single `parameters` field rendered by `ResourceParametersField`
   *                               which reads the schema from ui:options.rtdSchema
   */
  private generateParameters(
    rt: ResourceTypeCRD,
    defaultNamespace: string,
    rtdKind: RtdKind,
    title: string,
  ): any[] {
    const metadataSection = {
      title: 'Resource Metadata',
      required: ['project_namespace', 'resource_name'],
      properties: {
        project_namespace: {
          title: 'Project & Namespace',
          type: 'object',
          'ui:field': 'ProjectNamespaceField',
          'ui:options': {
            defaultNamespace,
          },
          properties: {
            project_name: { type: 'string' },
            namespace_name: { type: 'string' },
          },
          required: ['project_name', 'namespace_name'],
        },
        resource_name: {
          title: 'Resource Name',
          type: 'string',
          description:
            'Unique name for your Resource (must be a valid Kubernetes name)',
          'ui:field': 'ResourceNamePicker',
          'ui:options': {
            catalogKind: 'Resource',
            resourceLabel: 'Resource',
            namespaceField: 'project_namespace.namespace_name',
          },
        },
        displayName: {
          title: 'Display Name',
          type: 'string',
          description: 'A human-readable display name for the Resource',
        },
        description: {
          title: 'Description',
          type: 'string',
          description: 'Describe what this Resource is for',
        },
      },
    };

    const detailsUiOptions: Record<string, unknown> = {
      rtdName: rt.metadata.name,
      rtdKind,
      rtdDisplayName: title,
    };
    if (rt.spec.parameters?.openAPIV3Schema) {
      detailsUiOptions.rtdSchema = rt.spec.parameters.openAPIV3Schema;
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

    return [metadataSection, detailsSection];
  }

  private generateSteps(rt: ResourceTypeCRD, rtdKind: RtdKind): any[] {
    return [
      {
        id: 'create-resource',
        name: 'Create OpenChoreo Resource',
        action: 'openchoreo:resource:create',
        input: {
          namespaceName: '${{ parameters.project_namespace.namespace_name }}',
          projectName: '${{ parameters.project_namespace.project_name }}',
          resourceName: '${{ parameters.resource_name }}',
          displayName: '${{ parameters.displayName }}',
          description: '${{ parameters.description }}',
          typeKind: rtdKind,
          typeName: rt.metadata.name,
          parameters: '${{ parameters.parameters }}',
        },
      },
    ];
  }
}
