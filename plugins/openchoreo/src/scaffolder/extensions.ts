import { makeFormFieldExtension } from './makeFormFieldExtension';

// Single source of truth for OpenChoreo scaffolder field extensions.
// Blueprint names here MUST stay in lockstep with the entries listed in
// plugins/openchoreo/src/alpha.test.tsx (ALPHA_EXTENSION_NAMES).
export const scaffolderFieldExtensions = [
  makeFormFieldExtension(
    'advanced-configuration-field',
    () => import('./AdvancedConfigurationField/AdvancedConfigurationField'),
    m => ({
      name: 'AdvancedConfigurationField',
      component: m.AdvancedConfigurationField,
      schema: m.AdvancedConfigurationFieldSchema,
      validation: m.advancedConfigurationFieldValidation,
    }),
  ),
  makeFormFieldExtension(
    'build-and-deploy-field',
    () => import('./BuildAndDeployField/BuildAndDeployField'),
    m => ({
      name: 'BuildAndDeployField',
      component: m.BuildAndDeployField,
      schema: m.BuildAndDeployFieldSchema,
    }),
  ),
  makeFormFieldExtension(
    'build-template-parameters',
    () => import('./BuildTemplateParameters/BuildTemplateParametersExtension'),
    m => ({
      name: 'BuildTemplateParameters',
      component: m.BuildTemplateParameters,
      validation: m.buildTemplateParametersValidation,
    }),
  ),
  makeFormFieldExtension(
    'build-template-picker',
    () => import('./BuildTemplatePicker/BuildTemplatePickerExtension'),
    m => ({
      name: 'BuildTemplatePicker',
      component: m.BuildTemplatePicker,
      validation: m.buildTemplatePickerValidation,
    }),
  ),
  makeFormFieldExtension(
    'build-workflow-parameters',
    () => import('./BuildWorkflowParameters/BuildWorkflowParametersExtension'),
    m => ({
      name: 'BuildWorkflowParameters',
      component: m.BuildWorkflowParameters,
      schema: m.BuildWorkflowParametersSchema,
      validation: m.buildWorkflowParametersValidation,
    }),
  ),
  makeFormFieldExtension(
    'build-workflow-picker',
    () => import('./BuildWorkflowPicker/BuildWorkflowPickerExtension'),
    m => ({
      name: 'BuildWorkflowPicker',
      component: m.BuildWorkflowPicker,
      schema: m.BuildWorkflowPickerSchema,
      validation: m.buildWorkflowPickerValidation,
    }),
  ),
  makeFormFieldExtension(
    'cluster-component-type-yaml-editor',
    () =>
      import(
        './ClusterComponentTypeYamlEditor/ClusterComponentTypeYamlEditorExtension'
      ),
    m => ({
      name: 'ClusterComponentTypeYamlEditor',
      component: m.ClusterComponentTypeYamlEditorExtension,
      validation: m.clusterComponentTypeYamlEditorValidation,
    }),
  ),
  makeFormFieldExtension(
    'cluster-project-type-yaml-editor',
    () =>
      import(
        './ClusterProjectTypeYamlEditor/ClusterProjectTypeYamlEditorExtension'
      ),
    m => ({
      name: 'ClusterProjectTypeYamlEditor',
      component: m.ClusterProjectTypeYamlEditorExtension,
      validation: m.clusterProjectTypeYamlEditorValidation,
    }),
  ),
  makeFormFieldExtension(
    'cluster-resource-type-yaml-editor',
    () =>
      import(
        './ClusterResourceTypeYamlEditor/ClusterResourceTypeYamlEditorExtension'
      ),
    m => ({
      name: 'ClusterResourceTypeYamlEditor',
      component: m.ClusterResourceTypeYamlEditorExtension,
      validation: m.clusterResourceTypeYamlEditorValidation,
    }),
  ),
  makeFormFieldExtension(
    'cluster-trait-yaml-editor',
    () => import('./ClusterTraitYamlEditor/ClusterTraitYamlEditorExtension'),
    m => ({
      name: 'ClusterTraitYamlEditor',
      component: m.ClusterTraitYamlEditorExtension,
      validation: m.clusterTraitYamlEditorValidation,
    }),
  ),
  makeFormFieldExtension(
    'cluster-workflow-yaml-editor',
    () =>
      import('./ClusterWorkflowYamlEditor/ClusterWorkflowYamlEditorExtension'),
    m => ({
      name: 'ClusterWorkflowYamlEditor',
      component: m.ClusterWorkflowYamlEditorExtension,
      validation: m.clusterWorkflowYamlEditorValidation,
    }),
  ),
  makeFormFieldExtension(
    'component-name-picker',
    () => import('./ComponentNamePicker/ComponentNamePickerExtension'),
    m => ({
      name: 'ComponentNamePicker',
      component: m.ComponentNamePicker,
      validation: m.componentNamePickerValidation,
    }),
  ),
  makeFormFieldExtension(
    'component-type-yaml-editor',
    () => import('./ComponentTypeYamlEditor/ComponentTypeYamlEditorExtension'),
    m => ({
      name: 'ComponentTypeYamlEditor',
      component: m.ComponentTypeYamlEditorExtension,
      validation: m.componentTypeYamlEditorValidation,
    }),
  ),
  makeFormFieldExtension(
    'component-workflow-yaml-editor',
    () =>
      import(
        './ComponentWorkflowYamlEditor/ComponentWorkflowYamlEditorExtension'
      ),
    m => ({
      name: 'ComponentWorkflowYamlEditor',
      component: m.ComponentWorkflowYamlEditorExtension,
      validation: m.componentWorkflowYamlEditorValidation,
    }),
  ),
  makeFormFieldExtension(
    'container-image-field',
    () => import('./ContainerImageField/ContainerImageField'),
    m => ({
      name: 'ContainerImageField',
      component: m.ContainerImageField,
      schema: m.ContainerImageFieldSchema,
      validation: m.containerImageFieldValidation,
    }),
  ),
  makeFormFieldExtension(
    'deployment-pipeline-form-with-yaml',
    () =>
      import(
        './DeploymentPipelineFormWithYaml/DeploymentPipelineFormWithYamlExtension'
      ),
    m => ({
      name: 'DeploymentPipelineFormWithYaml',
      component: m.DeploymentPipelineFormWithYamlExtension,
      schema: m.DeploymentPipelineFormWithYamlSchema,
      validation: m.deploymentPipelineFormWithYamlValidation,
    }),
  ),
  makeFormFieldExtension(
    'deployment-pipeline-picker',
    () =>
      import('./DeploymentPipelinePicker/DeploymentPipelinePickerExtension'),
    m => ({
      name: 'DeploymentPipelinePicker',
      component: m.DeploymentPipelinePicker,
    }),
  ),
  makeFormFieldExtension(
    'deployment-source-picker',
    () => import('./DeploymentSourcePicker/DeploymentSourcePicker'),
    m => ({
      name: 'DeploymentSourcePicker',
      component: m.DeploymentSourcePicker,
      schema: m.DeploymentSourcePickerSchema,
    }),
  ),
  makeFormFieldExtension(
    'environment-form-with-yaml',
    () => import('./EnvironmentFormWithYaml/EnvironmentFormWithYamlExtension'),
    m => ({
      name: 'EnvironmentFormWithYaml',
      component: m.EnvironmentFormWithYamlExtension,
      schema: m.EnvironmentFormWithYamlSchema,
      validation: m.environmentFormWithYamlValidation,
    }),
  ),
  makeFormFieldExtension(
    'git-source-field',
    () => import('./GitSourceField/GitSourceField'),
    m => ({
      name: 'GitSourceField',
      component: m.GitSourceField,
      schema: m.GitSourceFieldSchema,
      validation: m.gitSourceFieldValidation,
    }),
  ),
  makeFormFieldExtension(
    'namespace-entity-picker',
    () => import('./NamespaceEntityPicker/NamespaceEntityPicker'),
    m => ({
      name: 'NamespaceEntityPicker',
      component: m.NamespaceEntityPicker,
    }),
  ),
  makeFormFieldExtension(
    'notification-channel-form-with-yaml',
    () =>
      import(
        './NotificationChannelFormWithYaml/NotificationChannelFormWithYamlExtension'
      ),
    m => ({
      name: 'NotificationChannelFormWithYaml',
      component: m.NotificationChannelFormWithYamlExtension,
      schema: m.NotificationChannelFormWithYamlSchema,
      validation: m.notificationChannelFormWithYamlValidation,
    }),
  ),
  makeFormFieldExtension(
    'project-namespace-field',
    () => import('./ProjectNamespaceField/ProjectNamespaceField'),
    m => ({
      name: 'ProjectNamespaceField',
      component: m.ProjectNamespaceField,
      schema: m.ProjectNamespaceFieldSchema,
      validation: m.projectNamespaceFieldValidation,
    }),
  ),
  makeFormFieldExtension(
    'project-parameters-field',
    () => import('./ProjectParametersField/ProjectParametersField'),
    m => ({
      name: 'ProjectParametersField',
      component: m.ProjectParametersField,
      schema: m.ProjectParametersFieldSchema,
    }),
  ),
  makeFormFieldExtension(
    'project-type-yaml-editor',
    () => import('./ProjectTypeYamlEditor/ProjectTypeYamlEditorExtension'),
    m => ({
      name: 'ProjectTypeYamlEditor',
      component: m.ProjectTypeYamlEditorExtension,
      validation: m.projectTypeYamlEditorValidation,
    }),
  ),
  makeFormFieldExtension(
    'resource-name-picker',
    () => import('./ResourceNamePicker/ResourceNamePickerExtension'),
    m => ({
      name: 'ResourceNamePicker',
      component: m.ResourceNamePicker,
      validation: m.resourceNamePickerValidation,
    }),
  ),
  makeFormFieldExtension(
    'resource-parameters-field',
    () => import('./ResourceParametersField/ResourceParametersField'),
    m => ({
      name: 'ResourceParametersField',
      component: m.ResourceParametersField,
      schema: m.ResourceParametersFieldSchema,
    }),
  ),
  makeFormFieldExtension(
    'resource-type-yaml-editor',
    () => import('./ResourceTypeYamlEditor/ResourceTypeYamlEditorExtension'),
    m => ({
      name: 'ResourceTypeYamlEditor',
      component: m.ResourceTypeYamlEditorExtension,
      validation: m.resourceTypeYamlEditorValidation,
    }),
  ),
  makeFormFieldExtension(
    'switch-field',
    () => import('./SwitchField/SwitchFieldExtension'),
    m => ({
      name: 'SwitchField',
      component: m.SwitchField,
      schema: m.SwitchFieldSchema,
    }),
  ),
  makeFormFieldExtension(
    'trait-yaml-editor',
    () => import('./TraitYamlEditor/TraitYamlEditorExtension'),
    m => ({
      name: 'TraitYamlEditor',
      component: m.TraitYamlEditorExtension,
      validation: m.traitYamlEditorValidation,
    }),
  ),
  makeFormFieldExtension(
    'traits-field',
    () => import('./TraitsField/TraitsFieldExtension'),
    m => ({
      name: 'TraitsField',
      component: m.TraitsField,
      validation: m.traitsFieldValidation,
    }),
  ),
  makeFormFieldExtension(
    'workload-details-field',
    () => import('./WorkloadDetailsField/WorkloadDetailsField'),
    m => ({
      name: 'WorkloadDetailsField',
      component: m.WorkloadDetailsField,
      schema: m.WorkloadDetailsFieldSchema,
      validation: m.workloadDetailsFieldValidation,
    }),
  ),
];
