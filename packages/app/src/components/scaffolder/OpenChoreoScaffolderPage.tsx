import { ScaffolderPage } from '@backstage/plugin-scaffolder';
import { ScaffolderFieldExtensions } from '@backstage/plugin-scaffolder-react';
import { ScaffolderLayout } from '../../scaffolder/ScaffolderLayout';
import { ComponentNamePickerFieldExtension } from '../../scaffolder/ComponentNamePicker';
import { ResourceNamePickerFieldExtension } from '../../scaffolder/ResourceNamePicker';
import { BuildTemplatePickerFieldExtension } from '../../scaffolder/BuildTemplatePicker';
import { BuildTemplateParametersFieldExtension } from '../../scaffolder/BuildTemplateParameters';
import { BuildWorkflowPickerFieldExtension } from '../../scaffolder/BuildWorkflowPicker';
import { BuildWorkflowParametersFieldExtension } from '../../scaffolder/BuildWorkflowParameters';
import { TraitsFieldExtension } from '../../scaffolder/TraitsField';
import { SwitchFieldExtension } from '../../scaffolder/SwitchField';
import { AdvancedConfigurationFieldExtension } from '../../scaffolder/AdvancedConfigurationField';
import { DeploymentSourcePickerFieldExtension } from '../../scaffolder/DeploymentSourcePicker';
import { BuildAndDeployFieldExtension } from '../../scaffolder/BuildAndDeployField';
import { ContainerImageFieldExtension } from '../../scaffolder/ContainerImageField';
import { ComponentTypeYamlEditorFieldExtension } from '../../scaffolder/ComponentTypeYamlEditor';
import { TraitYamlEditorFieldExtension } from '../../scaffolder/TraitYamlEditor';
import { ClusterComponentTypeYamlEditorFieldExtension } from '../../scaffolder/ClusterComponentTypeYamlEditor';
import { ClusterResourceTypeYamlEditorFieldExtension } from '../../scaffolder/ClusterResourceTypeYamlEditor';
import { ResourceTypeYamlEditorFieldExtension } from '../../scaffolder/ResourceTypeYamlEditor';
import { ClusterProjectTypeYamlEditorFieldExtension } from '../../scaffolder/ClusterProjectTypeYamlEditor';
import { ProjectTypeYamlEditorFieldExtension } from '../../scaffolder/ProjectTypeYamlEditor';
import { ResourceParametersFieldExtension } from '../../scaffolder/ResourceParametersField';
import { ProjectParametersFieldExtension } from '../../scaffolder/ProjectParametersField';
import { ClusterTraitYamlEditorFieldExtension } from '../../scaffolder/ClusterTraitYamlEditor';
import { ComponentWorkflowYamlEditorFieldExtension } from '../../scaffolder/ComponentWorkflowYamlEditor';
import { ClusterWorkflowYamlEditorFieldExtension } from '../../scaffolder/ClusterWorkflowYamlEditor';
import { GitSourceFieldExtension } from '../../scaffolder/GitSourceField';
import { ProjectNamespaceFieldExtension } from '../../scaffolder/ProjectNamespaceField';
import { NamespaceEntityPickerFieldExtension } from '../../scaffolder/NamespaceEntityPicker';
import { DeploymentPipelinePickerFieldExtension } from '../../scaffolder/DeploymentPipelinePicker';
import { EnvironmentFormWithYamlFieldExtension } from '../../scaffolder/EnvironmentFormWithYaml';
import { NotificationChannelFormWithYamlFieldExtension } from '../../scaffolder/NotificationChannelFormWithYaml';
import { DeploymentPipelineFormWithYamlFieldExtension } from '../../scaffolder/DeploymentPipelineFormWithYaml';
import { WorkloadDetailsFieldExtension } from '../../scaffolder/WorkloadDetailsField';
import { CustomTemplateListPage } from './CustomTemplateListPage';
import { OpenChoreoTemplateOutputs } from './OpenChoreoTemplateOutputs';
import { CustomReviewStep } from '../../scaffolder/CustomReviewState';

/**
 * Host's scaffolder page composition — `<ScaffolderPage>` with the
 * OpenChoreo header copy, the CustomTemplateListPage / CustomReviewStep
 * component overrides, and all 27 field-extension children. Used by the
 * `page:scaffolder` override in customOverrides.tsx so /create renders
 * through NFS without losing any of the host customizations the legacy
 * `<Route path="/create" element={<ScaffolderPage>...}>` mount supplied.
 */
export function OpenChoreoScaffolderPage() {
  return (
    <ScaffolderLayout>
      <ScaffolderPage
        headerOptions={{
          title: 'Create a new resource',
          subtitle:
            'Create new resources using standard templates in your organization',
        }}
        components={{
          EXPERIMENTAL_TemplateListPageComponent: CustomTemplateListPage,
          EXPERIMENTAL_TemplateOutputsComponent: OpenChoreoTemplateOutputs,
          ReviewStepComponent: CustomReviewStep,
        }}
      >
        <ScaffolderFieldExtensions>
          <ComponentNamePickerFieldExtension />
          <ResourceNamePickerFieldExtension />
          <ProjectNamespaceFieldExtension />
          <NamespaceEntityPickerFieldExtension />
          <DeploymentPipelinePickerFieldExtension />
          <BuildTemplatePickerFieldExtension />
          <BuildTemplateParametersFieldExtension />
          <BuildWorkflowPickerFieldExtension />
          <BuildWorkflowParametersFieldExtension />
          <TraitsFieldExtension />
          <SwitchFieldExtension />
          <AdvancedConfigurationFieldExtension />
          <DeploymentSourcePickerFieldExtension />
          <BuildAndDeployFieldExtension />
          <ContainerImageFieldExtension />
          <ComponentTypeYamlEditorFieldExtension />
          <TraitYamlEditorFieldExtension />
          <ClusterComponentTypeYamlEditorFieldExtension />
          <ClusterResourceTypeYamlEditorFieldExtension />
          <ResourceTypeYamlEditorFieldExtension />
          <ClusterProjectTypeYamlEditorFieldExtension />
          <ProjectTypeYamlEditorFieldExtension />
          <ResourceParametersFieldExtension />
          <ProjectParametersFieldExtension />
          <ClusterTraitYamlEditorFieldExtension />
          <ComponentWorkflowYamlEditorFieldExtension />
          <ClusterWorkflowYamlEditorFieldExtension />
          <EnvironmentFormWithYamlFieldExtension />
          <NotificationChannelFormWithYamlFieldExtension />
          <DeploymentPipelineFormWithYamlFieldExtension />
          <GitSourceFieldExtension />
          <WorkloadDetailsFieldExtension />
        </ScaffolderFieldExtensions>
      </ScaffolderPage>
    </ScaffolderLayout>
  );
}
