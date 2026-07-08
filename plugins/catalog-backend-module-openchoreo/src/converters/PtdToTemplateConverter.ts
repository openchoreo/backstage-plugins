import { Entity } from '@backstage/catalog-model';
import { JSONSchema7 } from 'json-schema';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

/**
 * Namespace used for cluster-scoped template entities (those generated
 * from `ClusterProjectType` rather than namespace-scoped `ProjectType`).
 * Matches the convention used by `RtdToTemplateConverter` /
 * `CtdToTemplateConverter`.
 */
const CLUSTER_TEMPLATE_NAMESPACE = 'openchoreo-cluster';

/**
 * (Cluster)ProjectType CRD shape consumed by the converter. Covers both
 * namespace-scoped `ProjectType` and cluster-scoped `ClusterProjectType`
 * — the only behavioural difference is the namespace the generated Template
 * lives in (handled by the separate `convertClusterPtdToTemplateEntity`
 * entrypoint). Unlike the Resource family, the `(Cluster)ProjectType` list
 * endpoint returns the full `spec.parameters.openAPIV3Schema` inline, so no
 * separate `/schema` fetch is needed.
 */
export interface ProjectTypeCRD {
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
  };
}

export interface PtdConverterConfig {
  /** Default owner for generated templates (required by the Template kind schema). */
  defaultOwner?: string;
}

type PtdKind = 'ProjectType' | 'ClusterProjectType';

/**
 * Converts OpenChoreo (Cluster)ProjectType CRDs into Backstage scaffolder
 * Template entities. Mirrors `RtdToTemplateConverter`: each ProjectType
 * becomes a per-type Project-creation wizard listed under
 * `/create?view=projects`.
 *
 * `PTD` (ProjectType Definition) is the umbrella term covering both scopes;
 * the actual K8s kind lives on the generated Template entity's
 * `openchoreo.io/ptd-kind` annotation as either `ProjectType` or
 * `ClusterProjectType`.
 *
 * The generated template emits one schema-driven `parameters` field via the
 * `ProjectParametersField` extension; the rendered form is built from
 * `spec.parameters.openAPIV3Schema` at runtime. The Project itself is created
 * by the `openchoreo:project:create` action, which sets `spec.type` +
 * `spec.parameters` on the Project CR.
 */
export class PtdToTemplateConverter {
  private readonly defaultOwner: string;

  constructor(config?: PtdConverterConfig) {
    this.defaultOwner = config?.defaultOwner || 'guests';
  }

  /** Convert a namespace-scoped ProjectType to a scaffolder Template entity. */
  convertPtdToTemplateEntity(
    pt: ProjectTypeCRD,
    namespaceName: string,
  ): Entity {
    return this.buildTemplate(pt, namespaceName, 'ProjectType');
  }

  /**
   * Convert a cluster-scoped ClusterProjectType to a scaffolder Template
   * entity living in the `openchoreo-cluster` namespace. The developer picks
   * the deployment namespace explicitly (no pre-filled default), since a
   * cluster-scoped type can back Projects in any namespace.
   */
  convertClusterPtdToTemplateEntity(cpt: ProjectTypeCRD): Entity {
    return this.buildTemplate(
      cpt,
      CLUSTER_TEMPLATE_NAMESPACE,
      'ClusterProjectType',
    );
  }

  private buildTemplate(
    pt: ProjectTypeCRD,
    templateNamespace: string,
    ptdKind: PtdKind,
  ): Entity {
    const templateName = this.generateTemplateName(pt.metadata.name);
    const title = pt.metadata.displayName || this.formatTitle(pt.metadata.name);
    const description = pt.metadata.description || `Create a ${title} project`;

    // For a namespace-scoped ProjectType, pre-fill the namespace dropdown with
    // the type's own namespace — a namespaced ProjectType can only back a
    // Project in that same namespace. For a ClusterProjectType the developer
    // picks any namespace, so no default is set.
    const defaultNamespaceRef =
      ptdKind === 'ClusterProjectType'
        ? undefined
        : `domain:default/${templateNamespace}`;

    const templateEntity: Entity = {
      apiVersion: 'scaffolder.backstage.io/v1beta3',
      kind: 'Template',
      metadata: {
        name: templateName,
        namespace: templateNamespace,
        title,
        description,
        annotations: {
          [CHOREO_ANNOTATIONS.PTD_NAME]: pt.metadata.name,
          [CHOREO_ANNOTATIONS.PTD_GENERATED]: 'true',
          [CHOREO_ANNOTATIONS.PTD_KIND]: ptdKind,
        },
      },
      spec: {
        owner: this.defaultOwner,
        type: 'Project',
        EXPERIMENTAL_formDecorators: [{ id: 'openchoreo:inject-user-token' }],
        parameters: this.generateParameters(
          pt,
          defaultNamespaceRef,
          ptdKind,
          title,
        ),
        steps: this.generateSteps(pt, ptdKind),
        output: {
          links: [
            {
              title: 'View Project',
              icon: 'kind:system',
              entityRef:
                "system:${{ steps['create-project'].output.namespaceName }}/${{ steps['create-project'].output.projectName }}",
            },
          ],
          // Rendered as a warning bar below the "View Project" link, but only
          // when auto deploy could not create some release bindings. The `if`
          // condition is evaluated by the scaffolder after the step runs
          // (falsy items are dropped), so on success no bar is shown. `icon`
          // drives the alert severity in OpenChoreoTemplateOutputs (the app's
          // custom outputs renderer); a title is intentionally omitted.
          text: [
            {
              if: "${{ steps['create-project'].output.autoDeployFailed }}",
              icon: 'warning',
              content:
                'Auto Deploy could not create release binding(s) for ' +
                "**${{ steps['create-project'].output.failedEnvironments }}**. " +
                'The project was created successfully, but it will not be ' +
                'deployed automatically — deploy it manually from the ' +
                "project's **Deploy** tab.",
            },
          ],
        },
      } as any,
    };

    if (pt.metadata.displayName) {
      templateEntity.metadata.annotations![
        CHOREO_ANNOTATIONS.PTD_DISPLAY_NAME
      ] = pt.metadata.displayName;
    }

    return templateEntity;
  }

  /** Template name format: `template-project-<ptd-name>`. */
  private generateTemplateName(ptName: string): string {
    return `template-project-${ptName}`;
  }

  /** Format `web-app` → `Web App`. */
  private formatTitle(name: string): string {
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Two parameter sections:
   *   1. Project Metadata — namespace + project_name (+ display name / description / deployment pipeline / auto deploy)
   *   2. <Display Name> Details — single `parameters` field rendered by `ProjectParametersField`
   *                               which reads the schema from ui:options.ptdSchema
   *
   * Field names match the existing scaffolder field extensions: `namespace_name`
   * (read by `DeploymentPipelinePicker` to scope its pipeline list) and
   * `deployment_pipeline`.
   */
  private generateParameters(
    pt: ProjectTypeCRD,
    defaultNamespaceRef: string | undefined,
    ptdKind: PtdKind,
    title: string,
  ): any[] {
    const namespaceProperty: Record<string, unknown> = {
      title: 'Namespace',
      type: 'string',
      description: 'Namespace where the project will be created',
      'ui:field': 'NamespaceEntityPicker',
    };
    // Pre-fill for namespaced ProjectTypes; NamespaceEntityPicker skips its
    // auto-select when formData is already populated from this default.
    if (defaultNamespaceRef) {
      namespaceProperty.default = defaultNamespaceRef;
    }

    const metadataSection = {
      title: 'Project Metadata',
      required: ['namespace_name', 'project_name', 'deployment_pipeline'],
      properties: {
        namespace_name: namespaceProperty,
        project_name: {
          title: 'Project Name',
          type: 'string',
          description:
            'Unique name for your project (must be a valid Kubernetes name)',
          'ui:field': 'ResourceNamePicker',
          'ui:options': {
            catalogKind: 'System',
            resourceLabel: 'Project',
            namespaceField: 'namespace_name',
          },
        },
        displayName: {
          title: 'Display Name',
          type: 'string',
          description: 'A human-readable display name for the Project',
        },
        description: {
          title: 'Description',
          type: 'string',
          description: 'Describe what this Project is for',
        },
        deployment_pipeline: {
          title: 'Deployment Pipeline',
          type: 'string',
          description: 'Deployment pipeline to associate with this project',
          'ui:field': 'DeploymentPipelinePicker',
        },
        auto_deploy: {
          title: 'Auto Deploy',
          type: 'boolean',
          description:
            'Automatically deploys the project to all environments in the deployment pipeline once created',
          default: true,
          'ui:field': 'SwitchField',
          'ui:options': {
            offWarning:
              'The project will not be deployed to any environment. You will ' +
              'need to deploy it manually from the project’s Deploy tab ' +
              'before you can deploy components.',
          },
        },
      },
    };

    const detailsUiOptions: Record<string, unknown> = {
      ptdName: pt.metadata.name,
      ptdKind,
      ptdDisplayName: title,
    };
    if (pt.spec.parameters?.openAPIV3Schema) {
      detailsUiOptions.ptdSchema = pt.spec.parameters.openAPIV3Schema;
    }

    const detailsSection = {
      title: `${title} Details`,
      properties: {
        parameters: {
          title: 'Parameters',
          type: 'object',
          'ui:field': 'ProjectParametersField',
          'ui:options': detailsUiOptions,
        },
      },
    };

    return [metadataSection, detailsSection];
  }

  private generateSteps(pt: ProjectTypeCRD, ptdKind: PtdKind): any[] {
    return [
      {
        id: 'create-project',
        name: 'Create OpenChoreo Project',
        action: 'openchoreo:project:create',
        input: {
          namespaceName: '${{ parameters.namespace_name }}',
          projectName: '${{ parameters.project_name }}',
          displayName: '${{ parameters.displayName }}',
          description: '${{ parameters.description }}',
          deploymentPipeline: '${{ parameters.deployment_pipeline }}',
          autoDeploy: '${{ parameters.auto_deploy }}',
          typeKind: ptdKind,
          typeName: pt.metadata.name,
          parameters: '${{ parameters.parameters }}',
        },
      },
    ];
  }
}
